import { describe, expect, it, vi } from 'vitest';
import { SUBMIT_URL } from '../app/config';
import { readFileSync } from 'node:fs';

/**
 * The client must not know how to reach the sheet.
 *
 * The endpoint and the token used to be VITE_ variables, which Vite
 * substitutes into the bundle at build time -- so they shipped in the page
 * source, where anyone could read them and post to the sheet directly.
 * They now live in api/submit.ts, read from the server's own environment.
 */
const PROXY = readFileSync(new URL('../../api/submit.ts', import.meta.url), 'utf8');
const BUNDLE_SOURCES = ['../app/config.ts', '../app/telemetry.ts'].map((p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8'),
);

describe('submission goes through the server', () => {
  it('posts to our own origin, not to a third party', () => {
    expect(SUBMIT_URL.startsWith('/'), `${SUBMIT_URL} is not same-origin`).toBe(true);
  });

  it('never names the endpoint or the token in anything that ships', () => {
    for (const source of BUNDLE_SOURCES) {
      expect(source, 'the Apps Script url is back in the bundle').not.toMatch(
        /VITE_SHEETS_ENDPOINT|script\.google\.com/,
      );
      expect(source, 'the token is back in the bundle').not.toMatch(/VITE_SUBMIT_TOKEN/);
    }
  });

  it('reads both secrets from non-VITE server variables', () => {
    // A VITE_ prefix here would defeat the entire arrangement.
    expect(PROXY).toMatch(/process\.env\.SHEETS_ENDPOINT/);
    expect(PROXY).toMatch(/process\.env\.SUBMIT_TOKEN/);
    expect(PROXY).not.toMatch(/process\.env\.VITE_/);
  });

  it('attaches the token server-side and discards any the caller sent', () => {
    expect(PROXY).toMatch(/\.\.\.payload,\s*token\s*\}/);
  });
});

describe('the proxy itself', () => {
  /** Calls the handler with a body, returning the status and text. */
  async function call(body: unknown, method = 'POST', env: Record<string, string> = {}) {
    const mod = await import('../../api/submit');
    const prev = { ...process.env };
    Object.assign(process.env, { SHEETS_ENDPOINT: '', SUBMIT_TOKEN: '', ...env });

    let status = 0;
    let text = '';
    const res = {
      status(code: number) { status = code; return res; },
      setHeader() {},
      send(payload: string) { text = payload; },
    };
    const req = {
      method,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: {},
      setEncoding() {},
      on() {},
      once() {},
    };
    await mod.default(req as never, res as never);
    process.env = prev;
    return { status, text };
  }

  const GOOD = {
    kind: 'application',
    application: { email: 'ada@stanford.edu', name: 'Ada' },
    telemetry: { sessionId: 'x' },
  };

  it('refuses anything but POST and GET', async () => {
    expect((await call(GOOD, 'PUT')).status).toBe(405);
  });

  it('reports on a GET which variables are missing, and no values', async () => {
    const { status, text } = await call(null, 'GET');
    expect(status).toBe(503);
    const body = JSON.parse(text);
    expect(body.configured).toBe(false);
    expect(body.missing).toEqual(['SHEETS_ENDPOINT', 'SUBMIT_TOKEN']);
  });

  it('names only the variable actually missing', async () => {
    const { text } = await call(null, 'GET', { SHEETS_ENDPOINT: 'https://x/exec' });
    expect(JSON.parse(text).missing).toEqual(['SUBMIT_TOKEN']);
  });

  it('never puts a variable value in the health response', async () => {
    const { text } = await call(null, 'GET', {
      SHEETS_ENDPOINT: 'https://script.google.com/macros/s/SECRET/exec',
      SUBMIT_TOKEN: 'sekrit',
    });
    expect(text).not.toMatch(/SECRET|sekrit|script\.google/);
    expect(JSON.parse(text)).toEqual({ configured: true, missing: [] });
  });

  it('refuses a body that is not one of the two payloads', async () => {
    expect((await call({ kind: 'nonsense' })).status).toBe(400);
    expect((await call('not json at all')).status).toBe(400);
  });

  it('refuses an application without a usable email', async () => {
    const { status, text } = await call({ ...GOOD, application: { email: 'ada@stanford' } });
    expect(status).toBe(400);
    expect(text).toBe('bad email');
  });

  it('says "not configured" rather than leaking why', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { status, text } = await call(GOOD);
    expect(status).toBe(500);
    expect(text).toBe('not configured');
    // The reason goes to the log, which is not visible to a caller.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('forwards a good application with the server token attached', async () => {
    const fetchSpy = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const { status } = await call(GOOD, 'POST', {
      SHEETS_ENDPOINT: 'https://script.google.com/macros/s/AAA/exec',
      SUBMIT_TOKEN: 'sekrit',
    });
    expect(status).toBe(200);

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://script.google.com/macros/s/AAA/exec');
    const sent = JSON.parse(String(init.body));
    expect(sent.token, 'the server token was not attached').toBe('sekrit');
    expect(sent.application.email).toBe('ada@stanford.edu');
    vi.unstubAllGlobals();
  });

  it('cannot be tricked into forwarding a caller-supplied token', async () => {
    const fetchSpy = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    await call({ ...GOOD, token: 'attacker' }, 'POST', {
      SHEETS_ENDPOINT: 'https://example.com/exec',
      SUBMIT_TOKEN: 'sekrit',
    });
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).token).toBe('sekrit');
    vi.unstubAllGlobals();
  });

  it('reports upstream trouble as a gateway error, not a success', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('forbidden', { status: 200 })));
    const { status } = await call(GOOD, 'POST', {
      SHEETS_ENDPOINT: 'https://example.com/exec',
      SUBMIT_TOKEN: 'sekrit',
    });
    expect(status, 'a refused row must not read as sent').toBe(502);
    vi.unstubAllGlobals();
    spy.mockRestore();
  });

  it('accepts an abandonment beacon, which carries no application', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok', { status: 200 })));
    const { status } = await call(
      { kind: 'abandoned', telemetry: { stage: 'entered' } },
      'POST',
      { SHEETS_ENDPOINT: 'https://example.com/exec', SUBMIT_TOKEN: 'sekrit' },
    );
    expect(status).toBe(200);
    vi.unstubAllGlobals();
  });

  it('will not take an abandonment row on the strength of its kind alone', async () => {
    // As first written, `{kind:'abandoned'}` was enough: there is no email
    // to validate on that path, so nothing was checked at all.
    expect((await call({ kind: 'abandoned' })).text).toBe('no telemetry');
    expect((await call({ kind: 'abandoned', telemetry: {} })).text).toBe('unknown stage');
    expect(
      (await call({ kind: 'abandoned', telemetry: { stage: 'made-it-up' } })).text,
    ).toBe('unknown stage');
  });

  it('requires telemetry on an application too', async () => {
    expect((await call({ kind: 'application', application: { email: 'a@b.co' } })).text)
      .toBe('no telemetry');
  });

  it('accepts every stage the game can actually report', async () => {
    // If currentStage() gains a bucket and STAGES does not, real beacons
    // start being rejected. This is the test that says so.
    const { currentStage } = await import('../app/telemetry');
    const { createGameState } = await import('../state/gameState');
    const reachable = [
      createGameState(),
      { ...createGameState(), starter: 'goose' },
      { ...createGameState(), starter: 'goose', panelPresses: 1 },
      { ...createGameState(), flags: new Set(['puzzle:panels']) },
      { ...createGameState(), flags: new Set(['rival:beaten']) },
      { ...createGameState(), battleWon: true },
      { ...createGameState(), applied: true },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok', { status: 200 })));
    for (const state of reachable) {
      const stage = currentStage(state as never);
      const { status } = await call(
        { kind: 'abandoned', telemetry: { stage } },
        'POST',
        { SHEETS_ENDPOINT: 'https://example.com/exec', SUBMIT_TOKEN: 'sekrit' },
      );
      expect(status, `the proxy rejects the real stage "${stage}"`).toBe(200);
    }
    vi.unstubAllGlobals();
  });
});

/**
 * Same-origin proxy in front of the Apps Script endpoint.
 *
 * Vercel deploys anything under /api as a serverless function even when the
 * rest of the project is a static build, so this needs no server and no
 * framework. The point is that SHEETS_ENDPOINT and SUBMIT_TOKEN are read
 * here, at request time, from plain (non-VITE_) environment variables. A
 * VITE_ variable is substituted into the bundle at build time and is
 * therefore published; these are not.
 *
 * What this does NOT do is stop an anonymous write. Anyone who knows this
 * path can POST a plausible body and get a row: the function attaches the
 * token for them. That was true before as well -- the token shipped in the
 * bundle -- so the gain is not secrecy from a determined caller.
 *
 * The gain is a chokepoint. All traffic to the sheet now has to come through
 * one function we control, which means:
 *  - validation cannot be bypassed by posting straight at Apps Script
 *  - the token rotates without rebuilding the client
 *  - if the sheet ever gets spammed, the rate limit or challenge goes here,
 *    and the fix ships without touching the game or the script
 *
 * The exposure is write-only. There is no GET and no read path, so the worst
 * case is junk rows in a recruiting sheet, not disclosure.
 *
 * Env vars to set in Vercel (Project > Settings > Environment Variables):
 *   SHEETS_ENDPOINT  the Apps Script /exec url
 *   SUBMIT_TOKEN     must match SUBMIT_TOKEN in server/Code.gs
 */

/** Only the bits of the Node request and response this uses. */
interface Req {
  method?: string;
  url?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  setEncoding(encoding: string): void;
  on(event: string, listener: (chunk: string) => void): void;
  once(event: string, listener: () => void): void;
}

interface Res {
  status(code: number): Res;
  setHeader(name: string, value: string): void;
  send(body: string): void;
}

/** Generous for an application, far below anything worth storing. */
const MAX_BODY = 64 * 1024;

/**
 * Server-side variables this needs. Deliberately without a VITE_ prefix so
 * they are never substituted into the client bundle.
 */
const REQUIRED = ['SHEETS_ENDPOINT', 'SUBMIT_TOKEN'] as const;

/**
 * What Apps Script's reply means.
 *
 * server/Code.gs answers a bare word: 'ok' when a row was written,
 * 'forbidden' when the token did not match, 'unknown kind' for a payload it
 * does not handle, 'error' when it threw. Anything else is not our script
 * talking -- most often Google's HTML sign-in page, which is what an
 * undeployed or non-public web app serves.
 */
function classify(status: number, body: string): string {
  const reply = body.trim();
  if (status === 200 && reply === 'ok') return 'ok';
  if (reply === 'forbidden') return 'token-mismatch';
  if (reply === 'unknown kind') return 'reachable';
  if (reply === 'error') return 'script-threw';
  if (reply.startsWith('<') || reply.toLowerCase().includes('sign in')) return 'not-public';
  return `unexpected-${status}`;
}

/** One sentence per classification, for a log a human is reading. */
const ADVICE: Record<string, string> = {
  'token-mismatch':
    'SUBMIT_TOKEN in Vercel does not match SUBMIT_TOKEN in server/Code.gs.',
  'script-threw':
    'Apps Script threw. Usually SHEET_ID is still the placeholder, or the ' +
    'account cannot open that sheet. Check the Apps Script execution log.',
  'not-public':
    'That URL served a sign-in page, not the script. Re-deploy the web app ' +
    'with "Execute as: Me" and "Who has access: Anyone", and use the /exec ' +
    'URL from that deployment.',
};

/** Funnel buckets currentStage() can produce, in src/app/telemetry.ts. */
const STAGES = [
  'applied', 'beat-leader', 'beat-rival', 'cleared-panels',
  'attempting-panels', 'has-team', 'entered',
];

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  // A GET reports whether the deployment is wired up, naming any variable
  // that is missing but never echoing a value. Without this, a
  // "not configured" on a POST is indistinguishable from a typo in a
  // variable name, the wrong Vercel environment, or an env var added after
  // the last deploy -- and guessing between those is miserable.
  if (req.method === 'GET') {
    const missing = REQUIRED.filter((name) => !process.env[name]);
    res.setHeader('Content-Type', 'application/json');

    // ?check=upstream also asks Apps Script whether it is reachable and
    // whether the token matches. It sends a payload Code.gs does not handle,
    // so the answer costs a round trip and writes no row.
    let upstream: string | undefined;
    if (!missing.length && String(req.url ?? '').includes('check=upstream')) {
      upstream = await pingUpstream();
    }

    res.status(missing.length ? 503 : 200).send(
      JSON.stringify({ configured: missing.length === 0, missing, upstream }),
    );
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('post only');
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = await readJson(req);
  } catch (err) {
    res.status(400).send(err instanceof Error ? err.message : 'bad request');
    return;
  }

  // Shape check. The client is the only thing meant to call this, so a body
  // that does not look like one of its two payloads is not worth forwarding.
  const kind = payload.kind;
  if (kind !== 'application' && kind !== 'abandoned') {
    res.status(400).send('unknown kind');
    return;
  }
  const telemetry = payload.telemetry as Record<string, unknown> | undefined;
  if (!telemetry || typeof telemetry !== 'object') {
    res.status(400).send('no telemetry');
    return;
  }
  if (kind === 'application') {
    const application = payload.application as Record<string, unknown> | undefined;
    const email = typeof application?.email === 'string' ? application.email : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).send('bad email');
      return;
    }
  } else {
    // Abandonment rows have no email to check, so the funnel bucket is the
    // only thing that has to look real. Without this, `{kind:'abandoned'}`
    // on its own was enough to write a row.
    if (typeof telemetry.stage !== 'string' || !STAGES.includes(telemetry.stage)) {
      res.status(400).send('unknown stage');
      return;
    }
  }

  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length) {
    // Misconfiguration, not the caller's fault. The names go to the log and
    // to GET /api/submit; the POST body stays terse.
    console.error(
      `[submit] not configured: ${missing.join(', ')} unset. ` +
        'Set these in Vercel > Settings > Environment Variables (no VITE_ ' +
        'prefix), then redeploy -- env changes do not reach an existing ' +
        'deployment.',
    );
    res.status(500).send('not configured');
    return;
  }
  const endpoint = process.env.SHEETS_ENDPOINT as string;
  const token = process.env.SUBMIT_TOKEN as string;

  // The token is attached here, never in the browser. Anything the client
  // sent under that key is discarded.
  const forwarded = { ...payload, token };

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      // text/plain dodges the CORS preflight Apps Script cannot answer. It
      // does not matter server-side, but it keeps one code path upstream.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(forwarded),
      redirect: 'follow',
    });
    const text = (await upstream.text()).trim();
    const verdict = classify(upstream.status, text);
    if (verdict !== 'ok') {
      console.error(
        `[submit] apps script replied ${upstream.status} (${verdict}): ` +
          `${text.slice(0, 200)}` +
          (ADVICE[verdict] ? `\n  -> ${ADVICE[verdict]}` : ''),
      );
      // The verdict is a fixed word from the list above, not upstream's
      // body, so this cannot echo a sign-in page back to a caller.
      res.status(502).send(`upstream refused: ${verdict}`);
      return;
    }
    res.status(200).send('ok');
  } catch (err) {
    console.error('[submit] could not reach apps script', err);
    res.status(502).send('upstream unreachable');
  }
}

/**
 * Asks Apps Script whether it is there and whether the token matches.
 *
 * Deliberately sends a `kind` Code.gs does not handle: it checks the token
 * first and only then looks at the kind, so a correct token comes back
 * 'unknown kind' and a wrong one comes back 'forbidden' -- and neither
 * writes to the sheet.
 */
async function pingUpstream(): Promise<string> {
  try {
    const reply = await fetch(process.env.SHEETS_ENDPOINT as string, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ kind: 'ping', token: process.env.SUBMIT_TOKEN }),
      redirect: 'follow',
    });
    return classify(reply.status, await reply.text());
  } catch {
    return 'unreachable';
  }
}

/**
 * The body as JSON, however the platform handed it over.
 *
 * sendBeacon posts a text/plain Blob, which arrives as a string; a normal
 * fetch may arrive already parsed. Falls back to reading the stream.
 */
async function readJson(req: Req): Promise<Record<string, unknown>> {
  let raw: string;
  if (typeof req.body === 'string') {
    raw = req.body;
  } else if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  } else {
    raw = await new Promise<string>((resolve, reject) => {
      let data = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        data += chunk;
        if (data.length > MAX_BODY) reject(new Error('body too large'));
      });
      req.once('end', () => resolve(data));
      req.once('error', () => reject(new Error('read failed')));
    });
  }

  if (raw.length > MAX_BODY) throw new Error('body too large');
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
  return parsed as Record<string, unknown>;
}

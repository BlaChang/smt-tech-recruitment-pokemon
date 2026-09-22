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

/** Funnel buckets currentStage() can produce, in src/app/telemetry.ts. */
const STAGES = [
  'applied', 'beat-leader', 'beat-rival', 'cleared-panels',
  'attempting-panels', 'has-team', 'entered',
];

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

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

  const endpoint = process.env.SHEETS_ENDPOINT;
  const token = process.env.SUBMIT_TOKEN;
  if (!endpoint || !token) {
    // Misconfiguration, not the caller's fault. Say so in the log, not in
    // the response: a 500 body is visible to anyone who pokes at this.
    console.error('[submit] SHEETS_ENDPOINT or SUBMIT_TOKEN is not set');
    res.status(500).send('not configured');
    return;
  }

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
    if (!upstream.ok || text !== 'ok') {
      console.error(`[submit] apps script replied ${upstream.status}: ${text.slice(0, 200)}`);
      res.status(502).send('upstream refused');
      return;
    }
    res.status(200).send('ok');
  } catch (err) {
    console.error('[submit] could not reach apps script', err);
    res.status(502).send('upstream unreachable');
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

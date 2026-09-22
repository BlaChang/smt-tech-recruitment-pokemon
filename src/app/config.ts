/**
 * Where the application and the abandonment beacon are posted.
 *
 * Same origin on purpose. `api/submit.ts` is a Vercel serverless function
 * that holds the Apps Script url and the shared token in plain (non-VITE_)
 * environment variables and forwards the payload. Anything named VITE_* is
 * substituted into the bundle at build time and so is published; keeping
 * both on the server means neither appears in the page source.
 *
 * Posting same-origin also removes the CORS problem entirely, rather than
 * working around it with a text/plain content type.
 */
const DEFAULT_SUBMIT_URL = '/api/submit';

/** Override to post straight at Apps Script, or at a preview deployment. */
export const SUBMIT_URL: string = import.meta.env.VITE_SUBMIT_URL ?? DEFAULT_SUBMIT_URL;

/**
 * False when nothing will answer, which is `vite dev` without a function
 * behind it. Submissions are logged to the console instead, so local work
 * never needs the real endpoint and never writes to the real sheet.
 *
 * `vercel dev` does serve /api, so set VITE_SUBMIT_URL there to exercise
 * the real path.
 */
export const hasEndpoint = (): boolean =>
  !import.meta.env.DEV || Boolean(import.meta.env.VITE_SUBMIT_URL);

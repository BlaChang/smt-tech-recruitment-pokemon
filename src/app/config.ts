/**
 * Google Apps Script web-app URL that appends rows to the recruiting sheet.
 * Set VITE_SHEETS_ENDPOINT in .env.local; when it is empty the game logs
 * submissions to the console instead, so dev never needs the real endpoint.
 */
export const SHEETS_ENDPOINT: string = import.meta.env.VITE_SHEETS_ENDPOINT ?? '';

/**
 * Travels with every payload. Apps Script drops rows without it. This is
 * obfuscation against drive-by junk, not security — it ships in the bundle.
 */
export const SUBMIT_TOKEN: string = import.meta.env.VITE_SUBMIT_TOKEN ?? 'tech-gym';

export const hasEndpoint = (): boolean => SHEETS_ENDPOINT.length > 0;

/**
 * Linear-algebra-over-GF(2) helper the puzzle NPC hands out. The floor puzzle
 * is a 16-unknown linear system, so this is a legitimate tool rather than a
 * cheat. Leave empty to hide the offer entirely.
 *
 * TODO(SMT): point this at whichever calculator the team wants to endorse.
 */
export const GL2_CALCULATOR_URL: string = import.meta.env.VITE_GL2_CALCULATOR_URL ?? '';

export const hasGl2Calculator = (): boolean => GL2_CALCULATOR_URL.length > 0;

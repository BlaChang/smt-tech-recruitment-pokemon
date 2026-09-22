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



import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Telemetry, type Application } from '../app/telemetry';
import { createGameState } from '../state/gameState';

/**
 * The Apps Script reads the payload by field name, and nothing on either
 * side checks that those names exist. `t.puzzleMoves` did not — the field
 * is `panelPresses` — so that column wrote 0 for every row in both sheets
 * from the day it was added, and looked plausible the whole time.
 */
const GS = readFileSync(new URL('../../server/Code.gs', import.meta.url), 'utf8');

const snapshot = new Telemetry(() => createGameState()).snapshot();

const APPLICATION: Application = {
  email: '', name: '', kind: '', year: '', experience: '', link: '', built: '',
};

/** Header list and appendRow arguments for one sheet. */
function sheet(headersName: string, fnName: string) {
  const headers = [
    ...(new RegExp(`var ${headersName} = \\[(.*?)\\];`, 's').exec(GS)?.[1] ?? '')
      .matchAll(/'([^']+)'/g),
  ].map((m) => m[1]);
  const body = new RegExp(`function ${fnName}\\(body\\) \\{(.*?)\\n\\}`, 's').exec(GS)?.[1] ?? '';
  const row = /appendRow\(\[(.*?)\n {2}\]\);/s.exec(body)?.[1] ?? '';
  const values = row.trim().split('\n').map((l) => l.trim().replace(/,$/, '')).filter(Boolean);
  return { headers, values };
}

describe('the sheet and the payload agree', () => {
  it('reads only telemetry fields the game actually sends', () => {
    const referenced = [...new Set([...GS.matchAll(/\bt\.(\w+)/g)].map((m) => m[1]))];
    expect(referenced.length).toBeGreaterThan(5);
    for (const field of referenced) {
      expect(
        field in snapshot,
        `Code.gs reads t.${field}, which TelemetrySnapshot does not have`,
      ).toBe(true);
    }
  });

  it('reads only application fields the form actually sends', () => {
    for (const field of new Set([...GS.matchAll(/\bapp\.(\w+)/g)].map((m) => m[1]))) {
      expect(
        field in APPLICATION,
        `Code.gs reads app.${field}, which Application does not have`,
      ).toBe(true);
    }
  });

  it('writes exactly one value per column', () => {
    for (const [headers, fn] of [
      ['APPLICATION_HEADERS', 'appendApplication'],
      ['ABANDONED_HEADERS', 'appendAbandoned'],
    ] as const) {
      const { headers: cols, values } = sheet(headers, fn);
      expect(cols.length, `${headers} was not parsed`).toBeGreaterThan(5);
      expect(values.length, `${fn} writes ${values.length} values for ${cols.length} columns`)
        .toBe(cols.length);
    }
  });

  it('keeps email last on the abandoned sheet, because columns are appended', () => {
    // sheetFor adds missing headings on the right and refuses to reorder.
    // A column inserted mid-list would relabel every row already collected.
    const { headers } = sheet('ABANDONED_HEADERS', 'appendAbandoned');
    expect(headers.at(-1)).toBe('email');
  });
});

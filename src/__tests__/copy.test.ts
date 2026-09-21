import { describe, expect, it } from 'vitest';
import METRICS from '../content/fontMetrics.json';
import { INTRO } from '../content/intro';
import * as DIALOGUE from '../content/dialogue';
import { paginate } from '../ui/textbox';
import type { Renderer } from '../engine/renderer';
import type { Script, ScriptCommand } from '../content/script';
import { createGameState, type GameState } from '../state/gameState';

/**
 * The game draws with a fixed bitmap font, so copy that fits in a proportional
 * browser font may not fit here. These walk every line the player can see and
 * check it against the real glyph advances.
 */

const M = METRICS as { advances: number[]; first: number; space: number; missing: string };

function width(text: string): number {
  let w = 0;
  for (const ch of text) {
    const index = (ch.codePointAt(0) ?? 32) - M.first;
    w += M.advances[index] ?? M.space;
  }
  return w;
}

/** Same geometry as TextBox. */
const BOX_W = 240 - 8;
const PAD_X = 14;
const LINE_WIDTH = BOX_W - PAD_X * 2;
const LINES_PER_PAGE = 3;

const renderer = { measure: width } as unknown as Renderer;

/** Every line of dialogue, with the speaker that says it. */
/** Resolves dynamic lines against every starter, so all variants are checked. */
const SAMPLE_STATES = ['blobheart', 'goose', 'francis'].map((starter) => ({
  ...createGameState(),
  starter,
  playerName: 'NAME',
}));

function texts(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') {
    return SAMPLE_STATES.map((s) => (value as (st: GameState) => string)(s));
  }
  return [];
}

function lines(script: Script, out: Array<{ text: string; as?: string }> = []) {
  for (const cmd of script as ScriptCommand[]) {
    if ('say' in cmd) {
      const speakers = texts(cmd.as);
      for (const text of texts(cmd.say)) {
        out.push({ text, as: speakers[0] });
      }
      for (const as of speakers.slice(1)) out.push({ text: '', as });
    }
    if ('choice' in cmd) {
      for (const option of cmd.choice) out.push({ text: option });
      for (const branch of cmd.branch) lines(branch, out);
    }
    if ('ifFlag' in cmd) {
      lines(cmd.then, out);
      if (cmd.otherwise) lines(cmd.otherwise, out);
    }
    if ('ifState' in cmd) {
      lines(cmd.then, out);
      if (cmd.otherwise) lines(cmd.otherwise, out);
    }
  }
  return out;
}

function everything(): Array<{ text: string; as?: string }> {
  const scripts: Script[] = [INTRO];
  for (const value of Object.values(DIALOGUE)) {
    if (!Array.isArray(value)) continue;
    // Some exports are arrays of scripts (the Hall of Fame plaques).
    if (Array.isArray(value[0])) scripts.push(...(value as Script[]));
    else scripts.push(value as Script);
  }
  return scripts.flatMap((s) => lines(s));
}

describe('player-facing copy', () => {
  const all = everything();

  it('finds plenty of lines to check', () => {
    expect(all.length).toBeGreaterThan(50);
  });

  it('has no word too long to wrap onto a line', () => {
    // paginate can break between words but not inside one.
    for (const { text } of all) {
      for (const word of text.replace(/\n/g, ' ').split(' ')) {
        expect(width(word), `"${word}" is wider than the text box`).toBeLessThanOrEqual(LINE_WIDTH);
      }
    }
  });

  it('wraps every line within the box', () => {
    for (const { text } of all) {
      for (const page of paginate(text, renderer, LINE_WIDTH, LINES_PER_PAGE)) {
        for (const line of page) {
          expect(width(line), `overflowing line: "${line}"`).toBeLessThanOrEqual(LINE_WIDTH);
        }
      }
    }
  });

  it('keeps every speaker name plate on screen', () => {
    const speakers = new Set(all.map((l) => l.as).filter(Boolean) as string[]);
    expect(speakers.size).toBeGreaterThan(3);
    for (const name of speakers) {
      // Plate is the name plus padding on both sides, drawn from x=4.
      expect(4 + width(name) + PAD_X * 2, `name plate too wide: ${name}`).toBeLessThanOrEqual(240);
    }
  });

  it('uses only glyphs the font actually has', () => {
    const missing = new Set(M.missing);
    // {name} is substituted before drawing, so its braces never reach the font.
    const substituted = new Set(['—', '–', '‘', '’', '“', '”', '…']);
    for (const { text, as } of all) {
      for (const ch of text.replace(/\{name\}/g, 'NAME') + (as ?? '')) {
        if (substituted.has(ch)) continue;
        expect(missing.has(ch), `"${ch}" in "${text.slice(0, 40)}" is not in the font`).toBe(false);
        expect(ch.codePointAt(0) ?? 0, `"${ch}" is outside the baked range`).toBeLessThan(127);
      }
    }
  });

  it('introduces the professor by his full name', () => {
    const intro = lines(INTRO).map((l) => l.text).join(' ');
    expect(intro).toContain('PROFESSOR JUSTIN SYMMETREE');
  });

  it('explains the type triangle before asking the player to choose', () => {
    const intro = lines(INTRO).map((l) => l.text).join(' ');
    expect(intro).toMatch(/PW beats TD/);
    expect(intro).toMatch(/TD beats TECH/);
    expect(intro).toMatch(/TECH beats PW/);
  });

  it('names every rival somewhere in the copy', () => {
    const all = everything().map((l) => `${l.text} ${l.as ?? ''}`).join(' ');
    for (const name of ['CALISTA', 'RITWIN', 'BLAKE']) {
      expect(all, `${name} is never mentioned`).toContain(name);
    }
  });
});

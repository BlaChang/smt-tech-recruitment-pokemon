import { describe, expect, it } from 'vitest';
import { validate } from '../app/registry';
import { paginate } from '../ui/textbox';
import type { Renderer } from '../engine/renderer';
import { currentStage } from '../app/telemetry';
import { createGameState } from '../state/gameState';

describe('registry validation', () => {
  const good = {
    email: 'ada@stanford.edu',
    name: 'Ada',
    year: '',
    link: '',
    built: '',
  };

  it('accepts an email and a name with everything else blank', () => {
    expect(validate(good)).toBeNull();
  });

  it('rejects missing required fields', () => {
    expect(validate({ ...good, email: '' })).toMatch(/email/i);
    expect(validate({ ...good, name: '' })).toMatch(/name/i);
  });

  it('rejects a malformed email', () => {
    expect(validate({ ...good, email: 'ada@stanford' })).toMatch(/email/i);
  });
});

describe('text pagination', () => {
  // 5px per character, so 100px fits exactly 20 characters.
  const renderer = { measure: (s: string) => s.length * 5 } as unknown as Renderer;

  it('wraps on words and splits into pages of three lines', () => {
    const pages = paginate('aaa bbb ccc ddd eee fff ggg hhh iii jjj', renderer, 100, 3);
    expect(pages[0].length).toBeLessThanOrEqual(3);
    for (const page of pages) {
      for (const line of page) expect(line.length).toBeLessThanOrEqual(20);
    }
    expect(pages.flat().join(' ')).toBe('aaa bbb ccc ddd eee fff ggg hhh iii jjj');
  });

  it('honors explicit newlines', () => {
    const pages = paginate('one\ntwo\nthree', renderer, 100, 3);
    expect(pages[0]).toEqual(['one', 'two', 'three']);
  });

  it('never returns an empty page list', () => {
    expect(paginate('', renderer, 100, 3)).toEqual([['']]);
  });
});

describe('funnel stages', () => {
  it('advances through the recruiting funnel in order', () => {
    const state = createGameState();
    expect(currentStage(state)).toBe('entered');
    state.starter = 'francis';
    expect(currentStage(state)).toBe('has-team');
    state.panelPresses = 3;
    expect(currentStage(state)).toBe('attempting-panels');
    state.flags.add('puzzle:panels');
    expect(currentStage(state)).toBe('cleared-panels');
    state.flags.add('rival:beaten');
    expect(currentStage(state)).toBe('beat-rival');
    state.battleWon = true;
    expect(currentStage(state)).toBe('beat-leader');
    state.applied = true;
    expect(currentStage(state)).toBe('applied');
  });
});

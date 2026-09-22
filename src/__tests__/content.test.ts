import { describe, expect, it } from 'vitest';
import { KINDS, validate, YEARS } from '../app/registry';
import { MORE_INFO } from '../content/links';
import { paginate } from '../ui/textbox';
import type { Renderer } from '../engine/renderer';
import { currentStage } from '../app/telemetry';
import { createGameState } from '../state/gameState';

describe('registry validation', () => {
  const good = {
    email: 'ada@stanford.edu',
    name: 'Ada',
    kind: 'Wacky builder',
    year: '',
    experience: '',
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

  it('will not send without an answer to which kind of person you are', () => {
    // Required on purpose: the answer is the signal, and a blank one is
    // indistinguishable from someone who did not read the question.
    const problem = validate({ ...good, kind: '' });
    expect(problem).toBe('Pick which kind of person you are.');
    // The label is a whole question, so the generic "<label> is required."
    // would read as nonsense and quote the question back at them.
    expect(problem).not.toMatch(/SMT Tech is selecting|is required/);
  });

  it('accepts either kind, and only those two', () => {
    for (const kind of KINDS) {
      expect(validate({ ...good, kind: kind.value }), kind.value).toBeNull();
    }
    expect(validate({ ...good, kind: 'Both' })).toBeTruthy();
  });

  it('keeps the stored answers short enough to count', () => {
    // These land in a sheet column somebody will want to tally.
    for (const kind of KINDS) {
      expect(kind.value.length).toBeLessThanOrEqual(20);
      expect(kind.text.length, 'the prose is what carries the meaning')
        .toBeGreaterThan(kind.value.length);
    }
    expect(new Set(KINDS.map((k) => k.value)).size).toBe(KINDS.length);
  });

  it('accepts every year on the dropdown', () => {
    for (const year of YEARS) expect(validate({ ...good, year }), year).toBeNull();
  });

  it('accepts no year at all, since it is optional', () => {
    expect(validate({ ...good, year: '' })).toBeNull();
  });

  it('rejects a year that is not on the dropdown', () => {
    // Only reachable by editing the DOM, but the sheet column is meant to be
    // countable, and a stray "freshman" in it is not noticed until sort time.
    expect(validate({ ...good, year: 'freshman' })).toMatch(/year/i);
  });

  it('keeps what you know separate from which year you are', () => {
    // These used to share one free-text box, which made both unsortable.
    const filled = { ...good, year: 'Frosh', experience: 'some Python, zero web' };
    expect(validate(filled)).toBeNull();
    expect(filled.year).not.toContain('Python');
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

describe('the more-information link', () => {
  it('points at a real https url', () => {
    expect(MORE_INFO.url).toMatch(/^https:\/\//);
    expect(MORE_INFO.label.trim().length).toBeGreaterThan(0);
  });

  it('keeps the share token, without which the doc asks for a login', () => {
    // A Google Docs URL pasted from the address bar rather than from Share
    // loses ?usp=sharing and can land candidates on a permission wall at
    // the exact moment they are deciding whether to apply.
    expect(MORE_INFO.url).toContain('/document/d/');
    expect(MORE_INFO.url).toContain('usp=sharing');
  });
});

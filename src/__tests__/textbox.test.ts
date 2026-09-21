// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextBox } from '../ui/textbox';
import { audio } from '../engine/audio';
import type { Button, Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';

/**
 * Pressing A means two different things depending on timing: mid-typewriter
 * it fast-forwards the current page, and once the page is finished it turns
 * to the next one. Only the second is a real advance, and only that one is
 * announced.
 */

const renderer = { measure: (s: string) => s.length * 6 } as unknown as Renderer;

/** Input stub where each call reports one specific button as pressed. */
function keys(...down: Button[]): Input {
  const held = new Set(down);
  return {
    pressed: (b: Button) => held.has(b),
    down: (b: Button) => held.has(b),
    consume: (b: Button) => held.delete(b),
  } as unknown as Input;
}

const none = () => keys();

function played() {
  const names: string[] = [];
  vi.spyOn(audio, 'play').mockImplementation((n) => {
    names.push(n);
  });
  return names;
}

afterEach(() => vi.restoreAllMocks());

/** Ticks until the current page has fully typed out. */
function finishTyping(box: TextBox): void {
  for (let i = 0; i < 400; i++) box.update(none());
}

describe('advancing dialogue', () => {
  it('is silent when A only fast-forwards the typewriter', () => {
    const names = played();
    const box = new TextBox();
    box.show('A reasonably long line that takes a while to type out.', renderer);

    box.update(keys('a'));
    expect(names, 'fast-forward should make no sound').toEqual([]);
  });

  it('plays once A turns to the next page', () => {
    const names = played();
    const box = new TextBox();
    // Long enough to need more than one page.
    box.show(Array.from({ length: 40 }, (_, i) => `word${i}`).join(' '), renderer);

    finishTyping(box);
    expect(names).toEqual([]);

    box.update(keys('a'));
    expect(names).toEqual(['text']);
  });

  it('plays when A closes the final page', () => {
    const names = played();
    const box = new TextBox();
    box.show('Short.', renderer);
    finishTyping(box);

    expect(box.update(keys('a'))).toBe(true);
    expect(names).toEqual(['text']);
    expect(box.visible).toBe(false);
  });

  it('lets B advance silently', () => {
    const names = played();
    const box = new TextBox();
    box.show('Short.', renderer);
    finishTyping(box);

    expect(box.update(keys('b'))).toBe(true);
    expect(names, 'B should advance without the A chime').toEqual([]);
  });

  it('makes no sound while simply typing', () => {
    const names = played();
    const box = new TextBox();
    box.show('Short.', renderer);
    finishTyping(box);
    expect(names).toEqual([]);
  });

  it('fast-forwards, then announces the turn on a second press', () => {
    const names = played();
    const box = new TextBox();
    box.show(Array.from({ length: 40 }, (_, i) => `word${i}`).join(' '), renderer);

    box.update(keys('a')); // dumps the page, silent
    expect(names).toEqual([]);
    box.update(keys('a')); // turns the page, announced
    expect(names).toEqual(['text']);
  });
});

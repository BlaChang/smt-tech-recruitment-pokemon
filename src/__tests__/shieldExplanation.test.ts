// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ARPIT, BattleScene } from '../battle/battleScene';
import { createGameState } from '../state/gameState';
import type { Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';

/**
 * Arpit fields three shielded mons and the fight is often re-attempted, so
 * the line explaining what the shield wants would otherwise play six times
 * over two attempts. Once is ominous; six is throat-clearing.
 */
describe('the shield explanation', () => {
  it('is said once per run, not once per shield or once per attempt', () => {
    const shown: string[] = [];
    const state = { ...createGameState(), starter: 'goose', playerName: 'ADA' };
    const renderer = {
      measure: (t: string) => t.length * 5, clear() {}, rect() {}, strokeRect() {},
      text() {}, textCentered() {}, sprite() {}, ctx: { drawImage() {} },
    } as unknown as Renderer;

    for (let attempt = 0; attempt < 2; attempt++) {
      const scene = new BattleScene({
        renderer, state, opponent: ARPIT, track: () => {}, onEnd: () => {},
      });
      const inner = scene as unknown as {
        queue(...s: Array<string | (() => void) | { wait: number }>): void;
        phase: string; question: { answer: number } | null;
      };
      const original = inner.queue.bind(inner);
      inner.queue = (...steps) => {
        for (const s of steps) if (typeof s === 'string' && s) shown.push(s);
        original(...steps);
      };
      scene.onEnter();
      const input = { pressed: () => true, held: () => false, consume: () => {} } as unknown as Input;
      for (let i = 0; i < 3000 && inner.phase !== 'done'; i++) {
        if (inner.phase === 'question' && inner.question) {
          // Always answer correctly, so every shield opens a new question.
          const want = inner.question.answer;
          for (let k = 0; k < want; k++) scene.update(input);
        }
        scene.update(input);
      }
    }

    const explained = shown.filter((l) => l.includes('comes down for arithmetic'));
    const followups = shown.filter((l) => l.includes('Same rule'));

    // Exactly one: the first shield always asks, and the flag lives on the
    // save so the second attempt does not explain it again either.
    expect(explained.length, `explained ${explained.length} times`).toBe(1);
    // And the shields after it are still introduced, rather than the
    // question simply appearing with no line in front of it.
    expect(followups.length, 'a later shield said nothing at all').toBeGreaterThan(0);
  });
});

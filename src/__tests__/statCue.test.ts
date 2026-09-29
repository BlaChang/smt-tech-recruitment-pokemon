// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { BattleScene } from '../battle/battleScene';
import { audio } from '../engine/audio';
import { move } from '../battle/moves';
import { createMon } from '../battle/engine';
import { LEADER_TEAM, STARTERS } from '../battle/teams';
import { createGameState } from '../state/gameState';
import type { Renderer } from '../engine/renderer';

/**
 * Buff moves use the heal sound, and it has to land on the frame the stat
 * line appears -- not when the move resolved, which can be several text
 * pages earlier.
 */
function played(effectMoveId: string, hurt = false) {
  const heard: Array<{ at: number; name: string }> = [];
  const shown: string[] = [];
  let frame = 0;
  vi.spyOn(audio, 'play').mockImplementation((name) => { heard.push({ at: frame, name }); });

  const scene = new BattleScene({
    renderer: { measure: (t: string) => t.length * 5 } as unknown as Renderer,
    state: { ...createGameState(), starter: 'goose' },
    track: () => {},
    onEnd: () => {},
  });
  const inner = scene as unknown as {
    resolve(a: unknown, d: unknown, m: unknown, byPlayer: boolean): Array<string | (() => void)>;
  };
  const goose = createMon(STARTERS.find((s) => s.id === 'goose') as never);
  // A heal on a full-health mon reports "already stable" and heals nothing.
  if (hurt) goose.hp = Math.round(goose.spec.maxHp / 3);
  const steps = inner.resolve(goose, createMon(LEADER_TEAM[0]), move(effectMoveId), true);

  // Drain the way `pump` does: run functions, stop and record on strings.
  for (const step of steps) {
    frame++;
    if (typeof step === 'function') step();
    else shown.push(step);
  }
  vi.restoreAllMocks();
  return { heard, shown, steps };
}

describe('stat change cues', () => {
  it('plays the heal sound when a buff lands', () => {
    const { heard } = played('herdVolunteers');   // buff-attack
    expect(heard.map((h) => h.name)).toContain('heal');
  });

  it('plays it for a defence buff too', () => {
    const { heard } = played('refactor');         // buff-defense
    expect(heard.map((h) => h.name)).toContain('heal');
  });

  it('still uses the debuff sound for a stat going down', () => {
    const { heard } = played('scheduleSlip');     // debuff-attack
    expect(heard.map((h) => h.name)).toContain('debuff');
    expect(heard.map((h) => h.name)).not.toContain('heal');
  });

  it('fires immediately before the line, not pages earlier', () => {
    // The point of the change. The cue must be the step directly in front
    // of the text it belongs to, so `pump` plays it as that text appears.
    for (const [id, text, hurt] of [
      ['herdVolunteers', 'output rose', false],
      ['refactor', 'hardened', false],
      ['rollback', 'patched itself up', true],
    ] as const) {
      const { steps } = played(id, hurt);
      const line = steps.findIndex((s) => typeof s === 'string' && s.includes(text));
      expect(line, `${id} never produced "${text}"`).toBeGreaterThan(-1);
      expect(
        typeof steps[line - 1],
        `${id}: the step before "${text}" is not a sound`,
      ).toBe('function');
    }
  });

  it('says nothing when the stat could not move', () => {
    // "cannot go further" is not a stat change and gets no cue.
    const heard: string[] = [];
    vi.spyOn(audio, 'play').mockImplementation((n) => { heard.push(n); });
    const scene = new BattleScene({
      renderer: { measure: (t: string) => t.length * 5 } as unknown as Renderer,
      state: { ...createGameState(), starter: 'goose' },
      track: () => {}, onEnd: () => {},
    });
    const inner = scene as unknown as {
      resolve(a: unknown, d: unknown, m: unknown, b: boolean): Array<string | (() => void)>;
    };
    const goose = createMon(STARTERS.find((s) => s.id === 'goose') as never);
    const foe = createMon(LEADER_TEAM[0]);
    // Buff repeatedly until it is pinned at the ceiling.
    for (let i = 0; i < 8; i++) inner.resolve(goose, foe, move('herdVolunteers'), true);
    heard.length = 0;
    const steps = inner.resolve(goose, foe, move('herdVolunteers'), true);
    expect(steps.some((s) => typeof s === 'string' && s.includes('cannot go further'))).toBe(true);
    for (const s of steps) if (typeof s === 'function') s();
    expect(heard, 'a capped stat still played a cue').not.toContain('heal');
    vi.restoreAllMocks();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyMove,
  chooseEnemyMove,
  computeDamage,
  createMon,
  healsLeft,
  isFainted,
  MAX_HEALS,
  MAX_STAGE,
  MIN_STAGE,
} from '../battle/engine';
import { move, MOVES } from '../battle/moves';
import { LEADER_TEAM, playerTeam, SHIELDED_MON_ID, STARTERS } from '../battle/teams';
import { QUESTIONS, randomQuestion } from '../battle/questions';
import { BattleScene } from '../battle/battleScene';
import { createGameState } from '../state/gameState';
import type { Renderer } from '../engine/renderer';
import { audio } from '../engine/audio';

const always = (value: number) => () => value;

describe('damage', () => {
  it('always takes off at least one hit point', () => {
    const attacker = createMon({ ...STARTERS[0], attack: 1 });
    const defender = createMon({ ...LEADER_TEAM[0], defense: 999 });
    expect(computeDamage(attacker, defender, move('rateLimit'), always(0))).toBeGreaterThanOrEqual(1);
  });

  it('never exceeds a sane ceiling for the strongest move', () => {
    const attacker = createMon({ ...STARTERS[1], attack: 14 });
    const defender = createMon({ ...LEADER_TEAM[0], defense: 8 });
    const damage = computeDamage(attacker, defender, move('pushToMain'), always(0.999));
    expect(damage).toBeLessThan(defender.spec.maxHp);
  });

  it('never drops a defender below zero', () => {
    const attacker = createMon(STARTERS[1]);
    const defender = createMon(LEADER_TEAM[0]);
    defender.hp = 2;
    applyMove(attacker, defender, move('pushToMain'), always(0.5));
    expect(defender.hp).toBe(0);
  });
});

describe('shield', () => {
  it('reduces every incoming hit to a scratch until it drops', () => {
    const attacker = createMon(STARTERS[1]);
    const shielded = createMon(LEADER_TEAM[1], true);
    const result = applyMove(attacker, shielded, move('pushToMain'), always(0.5));
    expect(result.blockedByShield).toBe(true);
    expect(result.damage).toBe(1);

    shielded.shielded = false;
    const after = applyMove(attacker, shielded, move('pushToMain'), always(0.5));
    expect(after.damage).toBeGreaterThan(1);
  });

  it('is only on the ace', () => {
    expect(LEADER_TEAM.filter((m) => m.id === SHIELDED_MON_ID)).toHaveLength(1);
  });
});

describe('effects', () => {
  it('heals without overfilling', () => {
    const mon = createMon(STARTERS[0]);
    const foe = createMon(LEADER_TEAM[0]);
    const result = applyMove(mon, foe, move('hotfix'), always(0.5));
    expect(result.healed).toBe(0);
    expect(mon.hp).toBe(mon.spec.maxHp);
  });

  it('costs the attacker health on recoil', () => {
    const mon = createMon(STARTERS[1]);
    const foe = createMon(LEADER_TEAM[0]);
    const result = applyMove(mon, foe, move('pushToMain'), always(0.5));
    expect(result.recoil).toBeGreaterThan(0);
    expect(mon.hp).toBe(mon.spec.maxHp - result.recoil);
  });

  it('caps how many times a mon can heal', () => {
    const mon = createMon(STARTERS[0]);
    const foe = createMon(LEADER_TEAM[0]);
    const perHeal = Math.round(mon.spec.maxHp * 0.35);

    for (let i = 0; i < MAX_HEALS; i++) {
      mon.hp = 10;
      const result = applyMove(mon, foe, move('hotfix'), always(0.5));
      expect(result.healed).toBe(perHeal);
      expect(mon.hp).toBe(10 + perHeal);
    }

    // The cap is spent: further attempts burn the turn and restore nothing.
    expect(healsLeft(mon)).toBe(0);
    mon.hp = 10;
    const spent = applyMove(mon, foe, move('hotfix'), always(0.5));
    expect(spent.healed).toBe(0);
    expect(mon.hp).toBe(10);
    expect(spent.statText).toMatch(/no patches left/);
  });

  it('stops the AI reaching for a spent heal', () => {
    const mon = createMon(LEADER_TEAM[0]);
    mon.hp = 1;
    mon.healsUsed = MAX_HEALS;
    const chosen = chooseEnemyMove(mon, mon.spec.moves.map(move), always(0.1));
    expect(chosen.effect).not.toBe('heal');
  });

  it('reports whether a stat actually moved, not just that a move tried', () => {
    const mon = createMon(STARTERS[0]);
    const foe = createMon(LEADER_TEAM[0]);

    // First drop lands.
    const first = applyMove(mon, foe, move('scheduleSlip'), always(0.5));
    expect(first.statChanged).toBe(true);
    expect(first.statText).toMatch(/fell/);

    // Drive the foe to the floor, then try once more.
    while (foe.attackStage > MIN_STAGE) applyMove(mon, foe, move('scheduleSlip'), always(0.5));
    const capped = applyMove(mon, foe, move('scheduleSlip'), always(0.5));
    expect(capped.statChanged, 'a stat at its floor did not change').toBe(false);
    expect(capped.statText).toMatch(/cannot go further/);
  });

  it('reports statChanged for buffs too', () => {
    const mon = createMon(STARTERS[0]);
    const foe = createMon(LEADER_TEAM[0]);
    expect(applyMove(mon, foe, move('rubberDuck'), always(0.5)).statChanged).toBe(true);
    while (mon.attackStage < MAX_STAGE) applyMove(mon, foe, move('rubberDuck'), always(0.5));
    expect(applyMove(mon, foe, move('rubberDuck'), always(0.5)).statChanged).toBe(false);
  });

  it('caps stat stages', () => {
    const mon = createMon(STARTERS[0]);
    const foe = createMon(LEADER_TEAM[0]);
    for (let i = 0; i < 6; i++) applyMove(mon, foe, move('refactor'), always(0.5));
    expect(mon.defenseStage).toBe(2);
  });
});

describe('a full battle always terminates', () => {
  it('finishes within a turn budget for every starter and both AI extremes', () => {
    for (const starter of STARTERS) {
      for (const bias of [0, 0.999]) {
        const party = playerTeam(starter.id).map((s) => createMon(s));
        // No shield here: the shield is gated on a question, not on turns.
        const foes = LEADER_TEAM.map((s) => createMon(s));
        let p = 0;
        let e = 0;
        let turns = 0;

        while (p < party.length && e < foes.length && turns < 400) {
          turns++;
          const playerMove = move(party[p].spec.moves[turns % party[p].spec.moves.length]);
          applyMove(party[p], foes[e], playerMove, always(bias));
          if (isFainted(foes[e])) {
            e++;
            continue;
          }
          const enemyMove = chooseEnemyMove(foes[e], foes[e].spec.moves.map(move), always(bias));
          applyMove(foes[e], party[p], enemyMove, always(bias));
          if (isFainted(party[p])) p++;
        }

        expect(turns, `starter ${starter.id} bias ${bias} did not resolve`).toBeLessThan(400);
        expect(p >= party.length || e >= foes.length).toBe(true);
      }
    }
  });
});

describe('content integrity', () => {
  it('every referenced move exists', () => {
    for (const mon of [...STARTERS, ...LEADER_TEAM]) {
      expect(mon.moves.length, `${mon.name} should have 4 moves`).toBe(4);
      for (const id of mon.moves) expect(MOVES[id], `${mon.name} references ${id}`).toBeDefined();
    }
  });

  it('keeps the correct option after shuffling', () => {
    for (let i = 0; i < 100; i++) {
      const q = randomQuestion();
      const source = QUESTIONS.find((original) => original.prompt === q.prompt);
      expect(q.options[q.answer]).toBe(source?.options[source.answer]);
      expect(new Set(q.options).size).toBe(3);
    }
  });
});

describe('losing the battle', () => {
  it('reports the fainted mon without reading past the end of the party', () => {
    // Regression: finish(false) runs after partyIndex has already advanced
    // past the last mon, so reading `active` there crashed every loss.
    const messages: string[] = [];
    const state = { ...createGameState(), starter: 'francis' };
    const scene = new BattleScene({
      renderer: { measure: (s: string) => s.length * 5 } as unknown as Renderer,
      state,
      track: () => {},
      onEnd: () => {},
    });

    const internals = scene as unknown as {
      party: ReturnType<typeof createMon>[];
      partyIndex: number;
      queue(...steps: Array<string | (() => void) | { wait: number }>): void;
      finish(won: boolean): void;
    };
    const original = internals.queue.bind(internals);
    internals.queue = (...steps) => {
      for (const step of steps) if (typeof step === 'string') messages.push(step);
      original(...steps);
    };

    internals.party[0].hp = 0;
    internals.partyIndex = internals.party.length; // exactly the losing state

    expect(() => internals.finish(false)).not.toThrow();
    expect(messages[0]).toContain('FRANCIS');
  });
});

describe('low HP warning', () => {
  /** Runs the scene's update loop with the audio bus spied on. */
  function scene(hpFraction: number) {
    const played: string[] = [];
    vi.spyOn(audio, 'play').mockImplementation((name) => {
      played.push(name);
    });

    const state = { ...createGameState(), starter: 'francis' };
    const s = new BattleScene({
      renderer: { measure: (t: string) => t.length * 5 } as unknown as Renderer,
      state,
      track: () => {},
      onEnd: () => {},
    });
    const inner = s as unknown as {
      party: ReturnType<typeof createMon>[];
      phase: string;
      updateLowHpWarning(): void;
    };
    inner.phase = 'menu';
    inner.party[0].hp = Math.round(inner.party[0].spec.maxHp * hpFraction);
    return { inner, played };
  }

  afterEach(() => vi.restoreAllMocks());

  it('beeps as soon as the bar turns red', () => {
    const { inner, played } = scene(0.15);
    inner.updateLowHpWarning();
    expect(played).toEqual(['lowHp']);
  });

  it('stays quiet above the red threshold', () => {
    const { inner, played } = scene(0.5);
    for (let i = 0; i < 200; i++) inner.updateLowHpWarning();
    expect(played).toEqual([]);
  });

  it('repeats rather than firing every frame', () => {
    const { inner, played } = scene(0.1);
    for (let i = 0; i < 145; i++) inner.updateLowHpWarning();
    // 145 frames at a 72-frame period is two beeps, not 145.
    expect(played).toHaveLength(2);
  });

  it('stops once the mon is healed back out of the red', () => {
    const { inner, played } = scene(0.1);
    inner.updateLowHpWarning();
    inner.party[0].hp = inner.party[0].spec.maxHp;
    for (let i = 0; i < 200; i++) inner.updateLowHpWarning();
    expect(played).toHaveLength(1);
  });

  it('stops when the mon faints, rather than beeping over the KO', () => {
    const { inner, played } = scene(0.1);
    inner.party[0].hp = 0;
    for (let i = 0; i < 200; i++) inner.updateLowHpWarning();
    expect(played).toEqual([]);
  });

  it('stops once the battle is over', () => {
    const { inner, played } = scene(0.1);
    inner.phase = 'done';
    for (let i = 0; i < 200; i++) inner.updateLowHpWarning();
    expect(played).toEqual([]);
  });
});

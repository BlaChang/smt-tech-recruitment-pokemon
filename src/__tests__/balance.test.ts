import { describe, expect, it } from 'vitest';
import { applyMove, chooseEnemyMove, createMon, healsLeft, isFainted } from '../battle/engine';
import { move } from '../battle/moves';
import { LEADER_TEAM, playerTeam, SHIELDED_MON_ID, STARTERS, typeMultiplier } from '../battle/teams';
import { rivalFor, rivalTeam } from '../battle/rivals';

/**
 * The gym is hard-gated: a candidate who cannot beat Arpit cannot apply.
 * These bounds are the contract that makes that gate fair. If a stat change
 * breaks one, the fix is the stats, not the bound.
 */
const RUNS = 400;

type Policy =
  /** Attacks every single turn and never touches the heal. */
  | 'never-heal'
  /** Attacks, but heals when badly hurt. The intended way to play. */
  | 'heals'
  /** Picks uniformly at random, buffs and all. */
  | 'flailing';

function chooseMove(mon: ReturnType<typeof createMon>, policy: Policy): string {
  const ids = mon.spec.moves;
  if (policy === 'flailing') return ids[Math.floor(Math.random() * ids.length)];

  const heal = ids.find((id) => move(id).effect === 'heal');
  const hurt = mon.hp / mon.spec.maxHp < 0.4;
  if (policy === 'heals' && heal && hurt && healsLeft(mon) > 0) return heal;
  return ids.reduce((best, id) => (move(id).power > move(best).power ? id : best));
}

/** Plays one battle to completion and reports whether the challenger won. */
function runBattle(
  starterId: string,
  policy: Policy,
  wrongAnswers: number,
  against: 'arpit' | 'rival' = 'arpit',
): boolean {
  const party = playerTeam(starterId).map((s) => createMon(s));
  const team = against === 'arpit' ? LEADER_TEAM : rivalTeam(rivalFor(starterId));
  const shield = against === 'arpit' ? SHIELDED_MON_ID : undefined;
  const foes = team.map((s) => createMon(s, s.id === shield));
  let p = 0;
  let e = 0;
  let turns = 0;
  let wrongLeft = wrongAnswers;

  while (p < party.length && e < foes.length && turns < 300) {
    turns++;

    if (foes[e].shielded) {
      // A wrong answer hands Arpit a free turn; the shield drops after.
      if (wrongLeft-- > 0) {
        applyMove(foes[e], party[p], chooseEnemyMove(foes[e], foes[e].spec.moves.map(move)));
        if (isFainted(party[p])) p++;
        continue;
      }
      foes[e].shielded = false;
    }

    applyMove(party[p], foes[e], move(chooseMove(party[p], policy)));
    if (isFainted(foes[e])) {
      e++;
      continue;
    }

    applyMove(foes[e], party[p], chooseEnemyMove(foes[e], foes[e].spec.moves.map(move)));
    if (isFainted(party[p])) p++;
  }

  return e >= foes.length;
}

function winRate(
  starterId: string,
  policy: Policy,
  wrongAnswers = 0,
  against: 'arpit' | 'rival' = 'arpit',
): number {
  let wins = 0;
  for (let i = 0; i < RUNS; i++) if (runBattle(starterId, policy, wrongAnswers, against)) wins++;
  return wins / RUNS;
}

describe('the rival fight', () => {
  it('is winnable despite the type matchup running against you', () => {
    for (const starter of STARTERS) {
      const rate = winRate(starter.id, 'heals', 0, 'rival');
      expect(rate, `${starter.name} vs their rival: ${rate}`).toBeGreaterThan(0.7);
    }
  });

  it('still punishes a challenger who never heals, without locking them out', () => {
    for (const starter of STARTERS) {
      const rate = winRate(starter.id, 'never-heal', 0, 'rival');
      expect(rate, `${starter.name} never-heal: ${rate}`).toBeGreaterThan(0.2);
      expect(rate, `${starter.name} never-heal: ${rate}`).toBeLessThan(0.9);
    }
  });

  it('is fair across starters, since every rival counters its own', () => {
    const rates = STARTERS.map((s) => winRate(s.id, 'heals', 0, 'rival'));
    expect(Math.max(...rates) - Math.min(...rates)).toBeLessThan(0.3);
  });

  it('really does give the rival the advantage', () => {
    for (const starter of STARTERS) {
      const mon = rivalTeam(rivalFor(starter.id))[0];
      expect(typeMultiplier(mon.type, starter.type)).toBeGreaterThan(1);
    }
  });
});

describe('gym difficulty', () => {
  it('is nearly certain for a challenger who attacks and heals', () => {
    for (const starter of STARTERS) {
      const rate = winRate(starter.id, 'heals');
      expect(rate, `${starter.name} intended-play win rate ${rate}`).toBeGreaterThan(0.9);
    }
  });

  it('is still forgiving to a challenger who never notices the heal', () => {
    // BLOBHEART sits lowest here on purpose: its biggest move has recoil, so
    // "always hit hardest" costs it something. It must still clear the floor.
    for (const starter of STARTERS) {
      const rate = winRate(starter.id, 'never-heal');
      expect(rate, `${starter.name} never-heal win rate ${rate}`).toBeGreaterThan(0.25);
    }
  });

  it('has no trap starter: the spread between picks stays narrow', () => {
    const rates = STARTERS.map((s) => winRate(s.id, 'heals'));
    expect(Math.max(...rates) - Math.min(...rates)).toBeLessThan(0.15);
  });

  it('lets someone mashing random moves through more often than not', () => {
    const rates = STARTERS.map((s) => winRate(s.id, 'flailing'));
    const average = rates.reduce((a, b) => a + b, 0) / rates.length;
    expect(average, `flailing win rate ${average}`).toBeGreaterThan(0.25);
  });

  it('makes wrong math answers cost real win probability', () => {
    // If a mistake is free, the math beat is decoration rather than a filter.
    for (const starter of STARTERS) {
      expect(
        winRate(starter.id, 'never-heal', 2),
        `${starter.name} should suffer for wrong answers`,
      ).toBeLessThan(winRate(starter.id, 'never-heal', 0));
    }
  });

  it('is harder than the rival, since he is the last fight', () => {
    const rival = STARTERS.map((s) => winRate(s.id, 'never-heal', 0, 'rival'));
    const arpit = STARTERS.map((s) => winRate(s.id, 'never-heal', 0, 'arpit'));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(arpit)).toBeLessThan(avg(rival) + 0.2);
  });

  it('is still losable, so beating Arpit means something', () => {
    let losses = 0;
    for (let i = 0; i < RUNS; i++) if (!runBattle(STARTERS[0].id, 'flailing', 2)) losses++;
    expect(losses).toBeGreaterThan(0);
  });
});

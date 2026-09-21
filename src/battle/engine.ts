import type { Move } from './moves';
import { typeMultiplier, type MonSpec } from './teams';

export interface MonState {
  spec: MonSpec;
  hp: number;
  attackStage: number;
  defenseStage: number;
  /** While true, incoming damage is reduced to a scratch. */
  shielded: boolean;
  /** Heal moves are capped so a tanky mon can never out-heal a low-attack one. */
  healsUsed: number;
}

export const MIN_STAGE = -2;
export const MAX_STAGE = 2;
const STAGE_MULTIPLIER = [0.6, 0.8, 1, 1.3, 1.6];

/** Tuned so a full 3v3 runs about 15-20 turns: long enough to feel real, short enough to finish. */
const DAMAGE_SCALE = 0.6;
const HEAL_FRACTION = 0.35;
/**
 * Without a cap, an AI that heals 35% every turn beats any mon dealing less
 * than that per turn -- an unwinnable stalemate rather than a loss. Two uses
 * bounds total healing and guarantees every battle terminates.
 */
export const MAX_HEALS = 2;
const RECOIL_FRACTION = 0.25;

export function createMon(spec: MonSpec, shielded = false): MonState {
  return { spec, hp: spec.maxHp, attackStage: 0, defenseStage: 0, shielded, healsUsed: 0 };
}

export function healsLeft(mon: MonState): number {
  return Math.max(0, MAX_HEALS - mon.healsUsed);
}

export function stageMultiplier(stage: number): number {
  return STAGE_MULTIPLIER[clampStage(stage) - MIN_STAGE];
}

export function clampStage(stage: number): number {
  return Math.max(MIN_STAGE, Math.min(MAX_STAGE, stage));
}

export function isFainted(mon: MonState): boolean {
  return mon.hp <= 0;
}

export function computeDamage(
  attacker: MonState,
  defender: MonState,
  mv: Move,
  rng: () => number = Math.random,
): number {
  if (mv.power <= 0) return 0;
  const attack = attacker.spec.attack * stageMultiplier(attacker.attackStage);
  const defense = defender.spec.defense * stageMultiplier(defender.defenseStage);
  const variance = 0.85 + rng() * 0.15;
  const matchup = typeMultiplier(attacker.spec.type, defender.spec.type);
  const raw = mv.power * (attack / defense) * DAMAGE_SCALE * variance * matchup;
  return Math.max(1, Math.round(raw));
}

export interface MoveResult {
  missed: boolean;
  damage: number;
  healed: number;
  recoil: number;
  blockedByShield: boolean;
  /** Type matchup applied to this hit: >1 super effective, <1 resisted. */
  matchup: number;
  statText?: string;
  /**
   * True only when a stat stage actually changed. A move can report a stat
   * effect and still do nothing, when the stage is already at its cap, and
   * callers should not announce that as a hit.
   */
  statChanged: boolean;
}

/** Resolves one move and mutates both combatants. Pure apart from those mutations. */
export function applyMove(
  attacker: MonState,
  defender: MonState,
  mv: Move,
  rng: () => number = Math.random,
): MoveResult {
  const result: MoveResult = {
    missed: false,
    damage: 0,
    healed: 0,
    recoil: 0,
    blockedByShield: false,
    matchup: 1,
    statChanged: false,
  };

  if (rng() > mv.accuracy) {
    result.missed = true;
    return result;
  }

  if (mv.power > 0) {
    result.matchup = typeMultiplier(attacker.spec.type, defender.spec.type);
    let damage = computeDamage(attacker, defender, mv, rng);
    if (defender.shielded) {
      damage = 1;
      result.blockedByShield = true;
    }
    damage = Math.min(damage, defender.hp);
    defender.hp -= damage;
    result.damage = damage;

    if (mv.effect === 'recoil' && damage > 0) {
      const recoil = Math.min(attacker.hp, Math.max(1, Math.round(damage * RECOIL_FRACTION)));
      attacker.hp -= recoil;
      result.recoil = recoil;
    }
  }

  switch (mv.effect) {
    case 'heal': {
      if (healsLeft(attacker) <= 0) {
        result.statText = `${attacker.spec.name} has no patches left!`;
        break;
      }
      attacker.healsUsed++;
      const healed = Math.min(
        attacker.spec.maxHp - attacker.hp,
        Math.round(attacker.spec.maxHp * HEAL_FRACTION),
      );
      attacker.hp += healed;
      result.healed = healed;
      result.statText = healed > 0 ? `${attacker.spec.name} patched itself up!` : `${attacker.spec.name} is already stable.`;
      break;
    }
    case 'buff-attack': {
      const bump = bumpStage(attacker, 'attackStage', 1, `${attacker.spec.name}'s output rose!`);
      result.statText = bump.text;
      result.statChanged = bump.changed;
      break;
    }
    case 'buff-defense': {
      const bump = bumpStage(attacker, 'defenseStage', 1, `${attacker.spec.name} hardened!`);
      result.statText = bump.text;
      result.statChanged = bump.changed;
      break;
    }
    case 'debuff-attack': {
      const bump = bumpStage(defender, 'attackStage', -1, `${defender.spec.name}'s output fell!`);
      result.statText = bump.text;
      result.statChanged = bump.changed;
      break;
    }
    default:
      break;
  }

  return result;
}

function bumpStage(
  mon: MonState,
  key: 'attackStage' | 'defenseStage',
  delta: number,
  text: string,
): { text: string; changed: boolean } {
  const before = mon[key];
  mon[key] = clampStage(before + delta);
  const changed = mon[key] !== before;
  return { text: changed ? text : `${mon.spec.name} cannot go further.`, changed };
}

/**
 * Enemy move choice: heal when badly hurt, otherwise lean on damage with a
 * little noise so the same battle does not play out identically twice.
 */
export function chooseEnemyMove(self: MonState, moves: Move[], rng: () => number = Math.random): Move {
  const hurt = self.hp / self.spec.maxHp < 0.35;
  const heals = healsLeft(self) > 0 ? moves.filter((m) => m.effect === 'heal') : [];
  if (hurt && heals.length && rng() < 0.7) return heals[0];

  const damaging = moves.filter((m) => m.power > 0);
  const pool = damaging.length ? damaging : moves;
  if (rng() < 0.25) return pool[Math.floor(rng() * pool.length)];
  return pool.reduce((best, m) => (m.power * m.accuracy > best.power * best.accuracy ? m : best));
}

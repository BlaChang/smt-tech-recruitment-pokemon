/** SMT's three sides of the house. */
export type MonType = 'PW' | 'TD' | 'TECH';

/**
 * A rock-paper-scissors triangle: PW beats TD beats TECH beats PW.
 *
 * Because it is a cycle, every starter has exactly one good and one bad
 * matchup, so no pick is stronger overall -- only better or worse against a
 * particular opponent.
 */
export const TYPE_BEATS: Record<MonType, MonType> = {
  PW: 'TD',
  TD: 'TECH',
  TECH: 'PW',
};

/**
 * Deliberately gentler than the 2x/0.5x of the games.
 *
 * Every rival is matched to counter the player's starter, so the multiplier
 * always runs against them in that fight. At 1.6x/0.625x the resulting 2.56x
 * swing decided the battle before skill entered into it; 1.4x still makes
 * the matchup the main thing you feel without making it the only thing.
 */
export const SUPER_EFFECTIVE = 1.4;
export const NOT_VERY_EFFECTIVE = 0.714;

/** Damage multiplier for an attacker's type against a defender's. */
export function typeMultiplier(attacker: MonType, defender: MonType): number {
  if (TYPE_BEATS[attacker] === defender) return SUPER_EFFECTIVE;
  if (TYPE_BEATS[defender] === attacker) return NOT_VERY_EFFECTIVE;
  return 1;
}

/** The three types in cycle order, for drawing the triangle in the intro. */
export const TYPE_CYCLE: MonType[] = ['PW', 'TD', 'TECH'];

export interface MonSpec {
  id: string;
  name: string;
  type: MonType;
  maxHp: number;
  attack: number;
  defense: number;
  moves: string[];
  /** Placeholder sprite color until real art lands. */
  color: string;
  /** What the professor says when you hover this one. */
  blurb?: string;
  /** Said when it is sent out. */
  sendLine?: string;
}

/**
 * Stats are tuned by simulation, not by eye. One starter has to carry both
 * the rival fight and all three of Arpit's mons alone, hence the lopsided HP.
 *
 *   rival  ~92% for a challenger who attacks and heals, ~58% who never heals
 *   Arpit  ~90% / ~60%, and ~43% for someone mashing at random
 *
 * Arpit is the harder of the two, which is the point. Re-run
 * src/__tests__/balance.test.ts after touching any of these numbers.
 */
export const STARTERS: MonSpec[] = [
  {
    id: 'blobheart',
    name: 'BLOBHEART',
    type: 'PW',
    maxHp: 202,
    attack: 13,
    defense: 12,
    moves: ['proposal', 'hardGeo', 'rubberDuck', 'rollback'],
    color: '#c1553f',
    blurb: 'A red panda who writes problems. Sweet-natured, until you ask for an easy one.',
    sendLine: 'BLOBHEART uncurls and looks mildly disappointed in you.',
  },
  {
    id: 'goose',
    name: 'GOOSE',
    type: 'TD',
    maxHp: 170,
    attack: 17,
    defense: 11,
    moves: ['announcement', 'scheduleSlip', 'herdVolunteers', 'rollback'],
    color: '#4a7fc1',
    blurb: 'A seagull who runs tournaments. Loud, unbothered, has never once been on time and never once been late.',
    sendLine: 'GOOSE screams. Somehow, everyone knows where to go.',
  },
  {
    id: 'francis',
    name: 'FRANCIS',
    type: 'TECH',
    maxHp: 176,
    attack: 16,
    defense: 12,
    moves: ['mergeConflict', 'pushToMain', 'refactor', 'hotfix'],
    color: '#3f9e6a',
    blurb: 'A penguin who ships code. Has strong opinions about the scoreboard and will share them.',
    sendLine: 'FRANCIS waddles in and immediately opens a terminal.',
  },
];

/**
 * Arpit's three: one of each type, so every starter meets one good matchup,
 * one bad and one even.
 *
 * Their stats are kept close together on purpose. When the ace was much the
 * strongest, whichever starter happened to be weak against *it* was a trap
 * pick -- it met its worst matchup last, already worn down. Flattening the
 * curve makes slot order matter far less than the matchup itself.
 */
export const LEADER_TEAM: MonSpec[] = [
  {
    id: 'maytrix',
    name: 'MAY TRIX',
    type: 'PW',
    maxHp: 70,
    attack: 9,
    defense: 11,
    moves: ['rowReduce', 'determinant', 'transpose', 'rollback'],
    color: '#8a5ea8',
    sendLine: 'MAY TRIX unfolds into four quadrants. None of them are the same size.',
  },
  {
    id: 'tesselation',
    name: 'TESS ELATION',
    type: 'TECH',
    maxHp: 70,
    attack: 9,
    defense: 12,
    moves: ['tileThePlane', 'penrose', 'symmetryGroup', 'hotfix'],
    color: '#d4a02a',
    sendLine: 'TESS ELATION tiles the floor, the walls, and part of the ceiling.',
  },
  {
    // Two creatures sharing one slot, the way a Dugtrio is three.
    id: 'pieuler',
    name: 'PI & EULER',
    type: 'TD',
    maxHp: 72,
    attack: 10,
    defense: 12,
    moves: ['deadline', 'announcement', 'symmetryGroup', 'hotfix'],
    color: '#5fb8d4',
    sendLine: 'PIRE BOY and EULER GIRL arrive together. They finish each other\'s proofs. Shielded.',
  },
];

/** The ace that hides behind a shield until the challenger answers a math question. */
export const SHIELDED_MON_ID = 'pieuler';

/**
 * Rival mons: the same creatures as the starters, but less developed.
 *
 * The handicap is HP only. The type chart already runs against the player in
 * every rival fight, so blunting the rival's attack as well made the battle
 * a formality; taking HP instead keeps their hits stinging while giving the
 * player room to win it.
 */
const RIVAL_HP = 0.55;
const RIVAL_ATTACK = 1.0;

export function asRival(spec: MonSpec): MonSpec {
  return {
    ...spec,
    maxHp: Math.round(spec.maxHp * RIVAL_HP),
    attack: Math.round(spec.attack * RIVAL_ATTACK),
  };
}

export function starterById(id: string | null): MonSpec {
  return STARTERS.find((s) => s.id === id) ?? STARTERS[0];
}

/** You get the one you picked. That is the whole point of picking. */
export function playerTeam(starterId: string | null): MonSpec[] {
  return [starterById(starterId)];
}

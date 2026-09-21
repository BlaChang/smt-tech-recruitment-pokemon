/** SMT's three sides of the house. Flavor only: no starter is a trap pick. */
export type MonType = 'PW' | 'TD' | 'TECH';

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
 * Stats are tuned, not vibed. The gym is hard-gated, so the floor matters:
 * a challenger who only ever attacks still wins ~83% of the time, one who
 * also uses their heal wins ~99%, and someone mashing at random wins ~57%.
 * One starter faces both of Arpit's mons alone, hence the lopsided HP.
 * Re-run src/__tests__/balance.test.ts after touching any of these numbers.
 */
export const STARTERS: MonSpec[] = [
  {
    id: 'blobheart',
    name: 'BLOBHEART',
    type: 'PW',
    maxHp: 126,
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
    maxHp: 106,
    attack: 15,
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
    maxHp: 110,
    attack: 14,
    defense: 12,
    moves: ['mergeConflict', 'pushToMain', 'refactor', 'hotfix'],
    color: '#3f9e6a',
    blurb: 'A penguin who ships code. Has strong opinions about the scoreboard and will share them.',
    sendLine: 'FRANCIS waddles in and immediately opens a terminal.',
  },
];

/** Arpit's two. Both are puns, and both of them know it. */
export const LEADER_TEAM: MonSpec[] = [
  {
    id: 'maytrix',
    name: 'MAY TRIX',
    type: 'PW',
    maxHp: 62,
    attack: 8,
    defense: 11,
    moves: ['rowReduce', 'determinant', 'transpose', 'rollback'],
    color: '#8a5ea8',
    sendLine: 'MAY TRIX unfolds into four quadrants. None of them are the same size.',
  },
  {
    id: 'tesselation',
    name: 'TESS ELATION',
    type: 'PW',
    maxHp: 70,
    attack: 9,
    defense: 12,
    moves: ['tileThePlane', 'penrose', 'symmetryGroup', 'hotfix'],
    color: '#d4a02a',
    sendLine: 'TESS ELATION tiles the floor, the walls, and part of the ceiling. Shielded.',
  },
];

/** The ace that hides behind a shield until the challenger answers a math question. */
export const SHIELDED_MON_ID = 'tesselation';

export function starterById(id: string | null): MonSpec {
  return STARTERS.find((s) => s.id === id) ?? STARTERS[0];
}

/** You get the one you picked. That is the whole point of picking. */
export function playerTeam(starterId: string | null): MonSpec[] {
  return [starterById(starterId)];
}

export type MoveEffect = 'none' | 'heal' | 'buff-attack' | 'buff-defense' | 'debuff-attack' | 'recoil';

export interface Move {
  id: string;
  name: string;
  power: number;
  accuracy: number;
  effect: MoveEffect;
  /** Shown after the move connects; keep it short, it shares the box with the hit text. */
  flavor?: string;
}

export const MOVES: Record<string, Move> = {
  proposal: {
    id: 'proposal',
    name: 'PROPOSAL',
    power: 27,
    accuracy: 1,
    effect: 'none',
    flavor: 'Submitted three minutes before the deadline.',
  },
  hardGeo: {
    id: 'hardGeo',
    name: 'HARD GEO',
    power: 44,
    accuracy: 0.85,
    effect: 'recoil',
    flavor: 'Nobody solved it. Nobody enjoyed it. It was beautiful.',
  },
  announcement: {
    id: 'announcement',
    name: 'ANNOUNCEMENT',
    power: 28,
    accuracy: 1,
    effect: 'none',
    flavor: 'Heard in every room at once, including the ones with doors closed.',
  },
  scheduleSlip: {
    id: 'scheduleSlip',
    name: 'SCHEDULE SLIP',
    power: 16,
    accuracy: 1,
    effect: 'debuff-attack',
    flavor: 'Everything is now running eleven minutes behind.',
  },
  herdVolunteers: {
    id: 'herdVolunteers',
    name: 'HERD VOLUNTEERS',
    power: 20,
    accuracy: 1,
    effect: 'buff-attack',
    flavor: 'Forty people, one clipboard, somehow it works.',
  },
  rowReduce: {
    id: 'rowReduce',
    name: 'ROW REDUCE',
    power: 26,
    accuracy: 1,
    effect: 'none',
    flavor: 'Everything below the pivot goes to zero.',
  },
  determinant: {
    id: 'determinant',
    name: 'DETERMINANT',
    power: 38,
    accuracy: 0.9,
    effect: 'none',
    flavor: 'If it is zero, nothing survives.',
  },
  transpose: {
    id: 'transpose',
    name: 'TRANSPOSE',
    power: 0,
    accuracy: 1,
    effect: 'buff-defense',
    flavor: 'Rows become columns. Good luck hitting that.',
  },
  tileThePlane: {
    id: 'tileThePlane',
    name: 'TILE THE PLANE',
    power: 30,
    accuracy: 1,
    effect: 'none',
    flavor: 'No gaps. No overlaps. No escape.',
  },
  penrose: {
    id: 'penrose',
    name: 'PENROSE',
    power: 40,
    accuracy: 0.9,
    effect: 'none',
    flavor: 'It never repeats, so you never see it coming twice.',
  },
  symmetryGroup: {
    id: 'symmetryGroup',
    name: 'SYMMETRY GROUP',
    power: 0,
    accuracy: 1,
    effect: 'buff-attack',
    flavor: 'Every rotation makes it stronger.',
  },
  mergeConflict: {
    id: 'mergeConflict',
    name: 'MERGE CONFLICT',
    power: 26,
    accuracy: 1,
    effect: 'none',
    flavor: 'Both sides insist they are correct.',
  },
  hotfix: {
    id: 'hotfix',
    name: 'HOTFIX',
    power: 0,
    accuracy: 1,
    effect: 'heal',
    flavor: 'Untested, but it works.',
  },
  pushToMain: {
    id: 'pushToMain',
    name: 'PUSH TO MAIN',
    power: 46,
    accuracy: 0.85,
    effect: 'recoil',
    flavor: 'No review. No regrets. Some regrets.',
  },
  rubberDuck: {
    id: 'rubberDuck',
    name: 'RUBBER DUCK',
    power: 0,
    accuracy: 1,
    effect: 'buff-attack',
    flavor: 'Explaining the bug out loud revealed the bug.',
  },
  refactor: {
    id: 'refactor',
    name: 'REFACTOR',
    power: 0,
    accuracy: 1,
    effect: 'buff-defense',
    flavor: 'Same behavior, fewer ways to break.',
  },
  rateLimit: {
    id: 'rateLimit',
    name: 'RATE LIMIT',
    power: 14,
    accuracy: 1,
    effect: 'debuff-attack',
    flavor: '429. Slow down.',
  },
  cacheInvalidate: {
    id: 'cacheInvalidate',
    name: 'CACHE INVALIDATE',
    power: 30,
    accuracy: 0.9,
    effect: 'none',
    flavor: 'One of the two hard problems.',
  },
  offByOne: {
    id: 'offByOne',
    name: 'OFF BY ONE',
    power: 22,
    accuracy: 1,
    effect: 'none',
    flavor: 'It hit one more time than expected.',
  },
  scopeCreep: {
    id: 'scopeCreep',
    name: 'SCOPE CREEP',
    power: 18,
    accuracy: 1,
    effect: 'buff-attack',
    flavor: 'While we are in here, we may as well...',
  },
  rollback: {
    id: 'rollback',
    name: 'ROLLBACK',
    power: 0,
    accuracy: 1,
    effect: 'heal',
    flavor: 'Back to the last version that worked.',
  },
  ddos: {
    id: 'ddos',
    name: 'REFRESH STORM',
    power: 34,
    accuracy: 0.9,
    effect: 'none',
    flavor: 'A thousand people hit F5 at once.',
  },
  deadline: {
    id: 'deadline',
    name: 'THE DEADLINE',
    power: 40,
    accuracy: 0.95,
    effect: 'none',
    flavor: 'The tournament does not move.',
  },
};

export function move(id: string): Move {
  const found = MOVES[id];
  if (!found) throw new Error(`Unknown move: ${id}`);
  return found;
}

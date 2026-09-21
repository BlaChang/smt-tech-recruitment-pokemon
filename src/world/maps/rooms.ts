import type { Direction } from '../direction';

/**
 * The gym is one map containing five rooms, joined by doorways that warp.
 * Each room is authored as its own small block of text so it stays readable,
 * and stamped into the full grid at its offset by buildGym().
 *
 * Legend is in tilemap.ts. In short:
 *   #  wall     .  octagon floor   ,  flat floor   D  doorway
 *   {}[]  corner cuts (the slanted corners that make rooms octagonal)
 *   P pillar   C console   S shelf
 *   b light panel   o boulder socket   O boulder spawn   G gate hub spawn
 */

export interface RoomDef {
  id: string;
  name: string;
  /** Top-left of this room within the full map, in tiles. */
  x: number;
  y: number;
  rows: string[];
}

/** Entry hall: where the player lands and meets the front desk. */
const ENTRY: RoomDef = {
  id: 'entry',
  name: 'ENTRANCE HALL',
  x: 1,
  y: 30,
  rows: [
    '######DD#######',
    '#{...........}#',
    '#.............#',
    '#..C.......S..#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#[...........]#',
    '###############',
  ],
};

/**
 * First puzzle: a 3x3 Lights Out on nine floor panels.
 *
 * Panels sit two tiles apart so any one can be reached without stepping on
 * another, and the block is offset from the doorway column so walking
 * through the room cannot solve it by accident.
 */
const PANELS: RoomDef = {
  id: 'panels',
  name: 'PANEL ROOM',
  x: 1,
  y: 17,
  rows: [
    '######DD#######',
    '#{...........}#',
    '#.............#',
    '#....b.b.b....#',
    '#.............#',
    '#....b.b.b....#',
    '#.............#',
    '#....b.b.b....#',
    '#.............#',
    '#..C.......C..#',
    '#.............#',
    '#[...........]#',
    '######DD#######',
  ],
};

/**
 * The Hall of Fame, borrowed from what sits past the Elite Four -- except
 * the plaques record what SMT tech has actually shipped. Every console along
 * the walls is readable.
 */
const HALL: RoomDef = {
  id: 'hall',
  name: 'HALL OF FAME',
  x: 1,
  y: 2,
  // Exactly six displays, evenly spaced along the far wall.
  rows: [
    '######DD#######',
    '#{...........}#',
    '#.C.C.C.C.C.C.#',
    '#.............#',
    '#.............#',
    '#,,,,,,,,,,,,,#',
    '#,,,,,,,,,,,,,#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#[...........]#',
    '######DD#######',
  ],
};

/** Where your rival is waiting. Narrow, so you cannot walk around them. */
const RIVAL: RoomDef = {
  id: 'rival',
  name: 'RIVAL ROOM',
  x: 20,
  y: 4,
  rows: [
    '######DD#######',
    '#{...........}#',
    '#.............#',
    '#..P.......P..#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#..P.......P..#',
    '#.............#',
    '#.............#',
    '#[...........]#',
    '######DD#######',
  ],
};

/**
 * Arpit's arena. Larger, and cut at depth two on every corner so it reads as
 * a proper octagon rather than a square with nicked edges.
 */
const ARENA: RoomDef = {
  id: 'arena',
  name: 'ARENA',
  x: 19,
  y: 19,
  rows: [
    '  ##{#######}##  ',
    ' ##{.........}## ',
    '##{...........}##',
    '#{.............}#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#[.............]#',
    '##[...........]##',
    ' ##[.........]## ',
    '  ##[##DD###]##  ',
  ],
};

export const ROOMS: RoomDef[] = [ENTRY, PANELS, HALL, RIVAL, ARENA];

export interface Warp {
  /** Door tile the player steps on. */
  x: number;
  y: number;
  /** Where they arrive. */
  toX: number;
  toY: number;
  facing: Direction;
  /** Flag that must be set, otherwise the door stays shut. */
  requires?: string;
  /** Shown when the door is locked. */
  lockedMessage?: string;
}

/** Absolute tile position of a door within a room block. */
function at(room: RoomDef, x: number, y: number): { x: number; y: number } {
  return { x: room.x + x, y: room.y + y };
}

/**
 * Doors come in pairs: stepping on one lands you just inside the other. Both
 * tiles of a two-wide doorway warp to the same place.
 */
function pair(
  from: RoomDef,
  fromX: number,
  fromY: number,
  to: RoomDef,
  toX: number,
  toY: number,
  facing: Direction,
  opts: { requires?: string; lockedMessage?: string } = {},
): Warp[] {
  const a = at(from, fromX, fromY);
  const b = at(to, toX, toY);
  return [
    { x: a.x, y: a.y, toX: b.x, toY: b.y, facing, ...opts },
    { x: a.x + 1, y: a.y, toX: b.x + 1, toY: b.y, facing, ...opts },
  ];
}

const NEEDS_PANELS = {
  requires: 'puzzle:panels',
  lockedMessage: 'The door will not open. Nine panels are dark behind you.',
};
const NEEDS_RIVAL = {
  requires: 'rival:beaten',
  lockedMessage: 'Your rival is still standing between you and that door.',
};

export const WARPS: Warp[] = [
  // Entry -> Panels
  ...pair(ENTRY, 6, 0, PANELS, 6, 11, 'up'),
  ...pair(PANELS, 6, 12, ENTRY, 6, 1, 'down'),
  // Panels -> Hall of Fame, gated on the light puzzle
  ...pair(PANELS, 6, 0, HALL, 6, 11, 'up', NEEDS_PANELS),
  ...pair(HALL, 6, 12, PANELS, 6, 1, 'down'),
  // Hall of Fame -> Rival
  ...pair(HALL, 6, 0, RIVAL, 6, 11, 'up'),
  ...pair(RIVAL, 6, 12, HALL, 6, 1, 'down'),
  // Rival -> Arena, gated on beating them
  ...pair(RIVAL, 6, 0, ARENA, 7, 11, 'up', NEEDS_RIVAL),
  ...pair(ARENA, 7, 12, RIVAL, 6, 1, 'down'),
];

/** Room containing a tile, or null if the tile is in the void between rooms. */
export function roomAt(x: number, y: number): RoomDef | null {
  for (const room of ROOMS) {
    const w = room.rows[0].length;
    const h = room.rows.length;
    if (x >= room.x && y >= room.y && x < room.x + w && y < room.y + h) return room;
  }
  return null;
}

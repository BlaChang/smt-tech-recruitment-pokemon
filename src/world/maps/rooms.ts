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
 * First puzzle: a 2x2 Lights Out on four floor panels.
 *
 * The panels sit off to one side rather than astride the doorway column, so
 * walking through the room cannot solve the puzzle by accident.
 */
const PANELS: RoomDef = {
  id: 'panels',
  name: 'PANEL ROOM',
  x: 1,
  y: 18,
  rows: [
    '######DD#######',
    '#{...........}#',
    '#.............#',
    '#.......b.b...#',
    '#.............#',
    '#.......b.b...#',
    '#.............#',
    '#..C.......C..#',
    '#.............#',
    '#[...........]#',
    '######DD#######',
  ],
};

/** Second puzzle: push two blocks into their sockets. */
const BOULDERS: RoomDef = {
  id: 'boulders',
  name: 'CRATE ROOM',
  x: 1,
  y: 4,
  rows: [
    '######DD#######',
    '#{...........}#',
    '#....o....o...#',
    '#.............#',
    '#.............#',
    '#..P.......P..#',
    '#....O...O....#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#[...........]#',
    '######DD#######',
  ],
};

/** Third puzzle: rotating gates, in the spirit of the Fortree City gym. */
const GATES: RoomDef = {
  id: 'gates',
  name: 'GATE ROOM',
  x: 20,
  y: 4,
  // Three gates, each filling a one-tile-wide gap in a wall. A gate's arms
  // span the whole gap, so the only way north is to spin each one upright.
  rows: [
    '######DD#######',
    '#{...........}#',
    '#.............#',
    '######.G.######',
    '#.............#',
    '#.............#',
    '###.G.#########',
    '#.............#',
    '#.............#',
    '#########.G.###',
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

export const ROOMS: RoomDef[] = [ENTRY, PANELS, BOULDERS, GATES, ARENA];

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
  lockedMessage: 'The door will not open. Four panels are dark behind you.',
};
const NEEDS_BOULDERS = {
  requires: 'puzzle:boulders',
  lockedMessage: 'Sealed. Both crates need to be seated in their sockets.',
};
export const WARPS: Warp[] = [
  // Entry -> Panels (and back)
  ...pair(ENTRY, 6, 0, PANELS, 6, 9, 'up'),
  ...pair(PANELS, 6, 10, ENTRY, 6, 1, 'down'),
  // Panels -> Boulders, gated on the light puzzle
  ...pair(PANELS, 6, 0, BOULDERS, 6, 11, 'up', NEEDS_PANELS),
  ...pair(BOULDERS, 6, 12, PANELS, 6, 1, 'down'),
  // Boulders -> Gates, gated on the crates
  ...pair(BOULDERS, 6, 0, GATES, 6, 11, 'up', NEEDS_BOULDERS),
  ...pair(GATES, 6, 12, BOULDERS, 6, 1, 'down'),
  // Gates -> Arena, gated on the rotating gates
  // No lock here: the gates themselves are the lock.
  ...pair(GATES, 6, 0, ARENA, 7, 11, 'up'),
  ...pair(ARENA, 7, 12, GATES, 6, 1, 'down'),
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

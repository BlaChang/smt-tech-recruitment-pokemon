import type { Direction } from './direction';
import { BOULDER_ROOM, GATE_ROOM } from './maps/gym';
import { SIZE } from '../puzzle/lightsOut';

/** Cells on the Lights Out board: the gym uses a 2x2. */
export const PANEL_CELLS = SIZE * SIZE;

/** Absolute positions of a character within a room block. */
function marks(room: { x: number; y: number; rows: string[] }, char: string): Array<{ x: number; y: number }> {
  const found: Array<{ x: number; y: number }> = [];
  room.rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === char) found.push({ x: room.x + dx, y: room.y + dy });
    }
  });
  return found;
}

/** Where each crate starts, read straight from the room's O markers. */
export function boulderStarts(): Array<{ x: number; y: number }> {
  return marks(BOULDER_ROOM, 'O');
}

export function boulderSockets(): Array<{ x: number; y: number }> {
  return marks(BOULDER_ROOM, 'o');
}

export function initialBoulders(): Array<{ x: number; y: number }> {
  return boulderStarts().map((b) => ({ ...b }));
}

/** Hub positions, read from the room's G markers, ordered top to bottom. */
export function gatePositions(): Array<{ id: string; x: number; y: number }> {
  return marks(GATE_ROOM, 'G').map((g, i) => ({ id: `gate${i}`, x: g.x, y: g.y }));
}

/**
 * Gates start lying across their gap, so every one of them has to be turned
 * upright before the corridor opens.
 */
export function initialGates(): Array<{ id: string; arms: Direction[] }> {
  return gatePositions().map((g) => ({ id: g.id, arms: ['left', 'right'] as Direction[] }));
}

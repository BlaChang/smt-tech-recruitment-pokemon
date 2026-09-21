import { TileMap } from '../tilemap';
import { ROOMS, type RoomDef } from './rooms';

/** Size of the full grid, derived from where the rooms sit. */
function extent(): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const room of ROOMS) {
    width = Math.max(width, room.x + room.rows[0].length);
    height = Math.max(height, room.y + room.rows.length);
  }
  return { width: width + 1, height: height + 1 };
}

/** Stamps every room into one grid; everything between them is solid void. */
export function buildGymRows(): string[] {
  const { width, height } = extent();
  const grid: string[][] = Array.from({ length: height }, () => new Array<string>(width).fill(' '));

  for (const room of ROOMS) {
    room.rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        grid[room.y + dy][room.x + dx] = row[dx];
      }
    });
  }

  return grid.map((row) => row.join(''));
}

export const GYM_ROWS = buildGymRows();
export const gymMap = new TileMap(GYM_ROWS);

function room(id: string): RoomDef {
  const found = ROOMS.find((r) => r.id === id);
  if (!found) throw new Error(`Unknown room: ${id}`);
  return found;
}

const ENTRY = room('entry');
const PANELS = room('panels');
const ARENA = room('arena');

/** Just inside the entrance, facing into the gym. */
export const PLAYER_SPAWN = { x: ENTRY.x + 7, y: ENTRY.y + 8, facing: 'up' as const };

/**
 * 3x3 Lights Out. Panels sit two tiles apart so you can reach any one of them
 * without crossing another, and off the doorway column so passing through the
 * room cannot solve it by accident.
 */
export const PANEL_ORIGIN = { x: PANELS.x + 5, y: PANELS.y + 3 };
export const PANEL_SPACING = 2;
export const PANEL_SIZE = 3;

export const ARENA_ROOM = ARENA;

/** Tile the gym leader stands on. */
export const LEADER_TILE = { x: ARENA.x + 8, y: ARENA.y + 3 };

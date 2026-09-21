import { describe, expect, it } from 'vitest';
import { gymMap, PANEL_ORIGIN, PANEL_SIZE, PANEL_SPACING, PLAYER_SPAWN } from '../world/maps/gym';
import { RIVALS, rivalFor, rivalTeam } from '../battle/rivals';
import { STARTERS, TYPE_BEATS, typeMultiplier } from '../battle/teams';
import { ROOMS, WARPS, roomAt } from '../world/maps/rooms';
import { NPCS } from '../content/npcs';
import { panelCellAt } from '../world/overworld';
import { tileDef } from '../world/tilemap';

const solid = (x: number, y: number) => gymMap.isSolid(x, y);

describe('rooms', () => {
  it('gives every room a rectangular block of text', () => {
    for (const room of ROOMS) {
      const widths = new Set(room.rows.map((r) => r.length));
      expect(widths.size, `${room.id} is ragged`).toBe(1);
    }
  });

  it('never overlaps two rooms', () => {
    const claimed = new Set<string>();
    for (const room of ROOMS) {
      room.rows.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++) {
          const key = `${room.x + dx},${room.y + dy}`;
          expect(claimed.has(key), `${room.id} overlaps another room at ${key}`).toBe(false);
          claimed.add(key);
        }
      });
    }
  });

  it('walls every room in, so you cannot walk into the void', () => {
    for (const room of ROOMS) {
      const w = room.rows[0].length;
      const h = room.rows.length;
      for (let dx = 0; dx < w; dx++) {
        for (const dy of [0, h - 1]) {
          const char = room.rows[dy][dx];
          // Doors are the only holes allowed in a room's perimeter.
          if (char === 'D') continue;
          expect(tileDef(char).solid, `${room.id} edge (${dx},${dy}) is open`).toBe(true);
        }
      }
      for (let dy = 0; dy < h; dy++) {
        for (const dx of [0, w - 1]) {
          const char = room.rows[dy][dx];
          if (char === 'D') continue;
          expect(tileDef(char).solid, `${room.id} edge (${dx},${dy}) is open`).toBe(true);
        }
      }
    }
  });

  it('chains the five rooms in the designed order', () => {
    expect(ROOMS.map((r) => r.id)).toEqual(['entry', 'panels', 'hall', 'rival', 'arena']);
  });

  it('cuts the arena corners so it reads as an octagon', () => {
    const arena = ROOMS.find((r) => r.id === 'arena');
    expect(arena).toBeDefined();
    const text = (arena?.rows ?? []).join('');
    for (const corner of ['{', '}', '[', ']']) {
      expect(text.includes(corner), `arena is missing a ${corner} corner`).toBe(true);
    }
  });
});

describe('warps', () => {
  it('starts and lands every warp on real tiles', () => {
    for (const warp of WARPS) {
      expect(gymMap.at(warp.x, warp.y), `warp source ${warp.x},${warp.y} is not a door`).toBe('D');
      expect(solid(warp.toX, warp.toY), `warp lands in a wall at ${warp.toX},${warp.toY}`).toBe(false);
      expect(roomAt(warp.toX, warp.toY), `warp lands outside any room`).not.toBeNull();
    }
  });

  it('gives every door tile a warp', () => {
    for (const door of gymMap.findAll('D')) {
      const warp = WARPS.find((w) => w.x === door.x && w.y === door.y);
      expect(warp, `door at ${door.x},${door.y} goes nowhere`).toBeDefined();
    }
  });

  it('links the five rooms in a chain, each onward door locked but the way back open', () => {
    const forward = WARPS.filter((w) => w.requires);
    expect(new Set(forward.map((w) => w.requires))).toEqual(
      new Set(['puzzle:panels', 'rival:beaten']),
    );
    for (const warp of WARPS.filter((w) => w.facing === 'down')) {
      expect(warp.requires, 'backtracking should never be locked').toBeUndefined();
    }
  });
});

describe('puzzle placement', () => {
  it('puts nine light panels in a 3x3, each reachable without crossing another', () => {
    const panels = gymMap.findAll('b');
    expect(PANEL_SIZE).toBe(3);
    expect(panels).toHaveLength(PANEL_SIZE * PANEL_SIZE);
    for (const p of panels) expect(panelCellAt(p.x, p.y)).not.toBeNull();
    // Spacing of two means a walkway separates neighbouring panels.
    expect(PANEL_SPACING).toBeGreaterThanOrEqual(2);
    expect(panelCellAt(PANEL_ORIGIN.x, PANEL_ORIGIN.y)).toBe(0);
    expect(panelCellAt(PANEL_ORIGIN.x + 1, PANEL_ORIGIN.y)).toBeNull();
  });
});

describe('rivals', () => {
  it('gives every starter a rival', () => {
    for (const starter of STARTERS) {
      expect(RIVALS[starter.id], `${starter.id} has no rival`).toBeDefined();
    }
  });

  it('always sends a rival whose type beats the player', () => {
    // The pairing is the point: whichever starter you take, the first real
    // fight is uphill by the same margin.
    for (const starter of STARTERS) {
      const rival = rivalFor(starter.id);
      const mon = rivalTeam(rival)[0];
      expect(TYPE_BEATS[mon.type], `${rival.name} should counter ${starter.name}`).toBe(starter.type);
      expect(typeMultiplier(mon.type, starter.type)).toBeGreaterThan(1);
      expect(typeMultiplier(starter.type, mon.type)).toBeLessThan(1);
    }
  });

  it('never has a rival field the starter you are holding', () => {
    for (const starter of STARTERS) {
      expect(rivalFor(starter.id).monId).not.toBe(starter.id);
    }
  });

  it('handicaps rival mons below the starter they copy', () => {
    for (const starter of STARTERS) {
      const mon = rivalTeam(rivalFor(starter.id))[0];
      const original = STARTERS.find((s) => s.id === mon.id);
      expect(mon.maxHp).toBeLessThan(original?.maxHp ?? 0);
      expect(mon.attack).toBeLessThanOrEqual(original?.attack ?? 0);
    }
  });
});

describe('inhabitants', () => {
  it('stands every NPC on open ground inside a room', () => {
    for (const npc of NPCS) {
      expect(solid(npc.x, npc.y), `${npc.id} is inside a wall`).toBe(false);
      expect(roomAt(npc.x, npc.y), `${npc.id} is outside every room`).not.toBeNull();
    }
  });

  it('never stacks two NPCs, or an NPC on a puzzle square', () => {
    const seen = new Set(NPCS.map((n) => `${n.x},${n.y}`));
    expect(seen.size).toBe(NPCS.length);
    const puzzleSquares = new Set(gymMap.findAll('b').map((p) => `${p.x},${p.y}`));
    for (const npc of NPCS) expect(puzzleSquares.has(`${npc.x},${npc.y}`)).toBe(false);
  });

  it('spawns the player on open ground in the entrance hall', () => {
    expect(solid(PLAYER_SPAWN.x, PLAYER_SPAWN.y)).toBe(false);
    expect(roomAt(PLAYER_SPAWN.x, PLAYER_SPAWN.y)?.id).toBe('entry');
  });
});

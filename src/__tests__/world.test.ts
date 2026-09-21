import { describe, expect, it } from 'vitest';
import { gymMap, PANEL_ORIGIN, PANEL_SIZE, PANEL_SPACING, PLAYER_SPAWN } from '../world/maps/gym';
import { ROOMS, WARPS, roomAt } from '../world/maps/rooms';
import { NPCS } from '../content/npcs';
import { panelCellAt } from '../world/overworld';
import { boulderSockets, boulderStarts, gatePositions, initialGates } from '../world/puzzleSetup';
import { armTiles } from '../puzzle/gates';
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
    // Panels and crates are flag-locked; the gate room is locked by its own geometry.
    expect(new Set(forward.map((w) => w.requires))).toEqual(
      new Set(['puzzle:panels', 'puzzle:boulders']),
    );
    for (const warp of WARPS.filter((w) => w.facing === 'down')) {
      expect(warp.requires, 'backtracking should never be locked').toBeUndefined();
    }
  });
});

describe('puzzle placement', () => {
  it('puts four light panels in a 2x2, each reachable without crossing another', () => {
    const panels = gymMap.findAll('b');
    expect(panels).toHaveLength(PANEL_SIZE * PANEL_SIZE);
    for (const p of panels) expect(panelCellAt(p.x, p.y)).not.toBeNull();
    // Spacing of two means a walkway separates neighbouring panels.
    expect(PANEL_SPACING).toBeGreaterThanOrEqual(2);
    expect(panelCellAt(PANEL_ORIGIN.x, PANEL_ORIGIN.y)).toBe(0);
    expect(panelCellAt(PANEL_ORIGIN.x + 1, PANEL_ORIGIN.y)).toBeNull();
  });

  it('gives every crate a socket and open ground to start on', () => {
    const starts = boulderStarts();
    const sockets = boulderSockets();
    expect(starts.length).toBeGreaterThan(0);
    expect(starts).toHaveLength(sockets.length);
    for (const s of [...starts, ...sockets]) expect(solid(s.x, s.y)).toBe(false);
  });

  it('starts every gate lying across its gap, fully blocking it', () => {
    const hubs = gatePositions();
    const gates = initialGates();
    expect(hubs.length).toBeGreaterThan(0);
    expect(gates).toHaveLength(hubs.length);

    for (const hub of hubs) {
      const gate = { ...hub, arms: gates.find((g) => g.id === hub.id)?.arms ?? [] };
      expect(gate.arms).toEqual(['left', 'right']);
      // The arms occupy open floor, and the squares beyond them are wall,
      // so the gate seals the corridor until it is turned.
      for (const arm of armTiles(gate)) {
        expect(solid(arm.x, arm.y), `arm at ${arm.x},${arm.y} starts inside a wall`).toBe(false);
      }
      expect(solid(hub.x - 2, hub.y), 'gap should be exactly one gate wide').toBe(true);
      expect(solid(hub.x + 2, hub.y), 'gap should be exactly one gate wide').toBe(true);
    }
  });

  it('leaves room above and below each gate for it to swing into', () => {
    for (const hub of gatePositions()) {
      expect(solid(hub.x, hub.y - 1), `gate ${hub.id} cannot swing up`).toBe(false);
      expect(solid(hub.x, hub.y + 1), `gate ${hub.id} cannot swing down`).toBe(false);
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
    const puzzleSquares = new Set(
      [...gymMap.findAll('b'), ...boulderStarts(), ...boulderSockets(), ...gatePositions()].map(
        (p) => `${p.x},${p.y}`,
      ),
    );
    for (const npc of NPCS) expect(puzzleSquares.has(`${npc.x},${npc.y}`)).toBe(false);
  });

  it('spawns the player on open ground in the entrance hall', () => {
    expect(solid(PLAYER_SPAWN.x, PLAYER_SPAWN.y)).toBe(false);
    expect(roomAt(PLAYER_SPAWN.x, PLAYER_SPAWN.y)?.id).toBe('entry');
  });
});

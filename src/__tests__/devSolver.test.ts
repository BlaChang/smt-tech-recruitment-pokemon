import { describe, expect, it } from 'vitest';
import { describeSolution } from '../app/devSolver';
import { isSolved, press, seedBoard, SIZE, solve } from '../puzzle/lightsOut';
import { PANEL_ORIGIN, PANEL_SPACING } from '../world/maps/gym';
import { gymMap } from '../world/maps/gym';
import { panelCellAt } from '../world/overworld';

/** Deterministic boards, so a failure is reproducible. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Pulls the "(x,y)" pairs back out of the printed report. */
function coordsFrom(report: string): Array<[number, number]> {
  const line = report.split('\n').find((l) => l.startsWith('map tiles:')) ?? '';
  return [...line.matchAll(/\((\d+),(\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

describe('dev lights-out solver', () => {
  it('prints coordinates that are really panel tiles', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const [x, y] of coordsFrom(describeSolution(seedBoard(rng(seed))))) {
        expect(gymMap.at(x, y), `${x},${y} is not a panel`).toBe('b');
        expect(panelCellAt(x, y)).not.toBeNull();
      }
    }
  });

  it('prints presses that actually light the board', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const board = seedBoard(rng(seed));
      const cells = coordsFrom(describeSolution(board)).map(([x, y]) => panelCellAt(x, y) as number);
      const solved = cells.reduce((b, c) => press(b, c), board);
      expect(isSolved(solved), `seed ${seed} was not solved by the printed plan`).toBe(true);
    }
  });

  it('agrees with the solver about how many presses are needed', () => {
    const board = seedBoard(rng(7));
    const expected = (solve(board) as number[]).length;
    const report = describeSolution(board);
    expect(report).toContain(`${expected} press`);
    expect(coordsFrom(report)).toHaveLength(expected);
  });

  it('draws the board it was given', () => {
    const board = seedBoard(rng(3));
    const lines = describeSolution(board).split('\n');
    const start = lines.indexOf('board (# lit, . dark):') + 1;
    const drawn = lines.slice(start, start + SIZE).map((l) => l.trim().split(' '));
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        expect(drawn[row][col]).toBe(board[row * SIZE + col] ? '#' : '.');
      }
    }
  });

  it('says so when the board is already lit', () => {
    expect(describeSolution(new Array<boolean>(SIZE * SIZE).fill(true))).toBe('lights out: solved');
  });

  it('spaces coordinates by the panel pitch, never adjacent', () => {
    const coords = coordsFrom(describeSolution(seedBoard(rng(11))));
    for (const [x, y] of coords) {
      expect((x - PANEL_ORIGIN.x) % PANEL_SPACING).toBe(0);
      expect((y - PANEL_ORIGIN.y) % PANEL_SPACING).toBe(0);
    }
  });
});

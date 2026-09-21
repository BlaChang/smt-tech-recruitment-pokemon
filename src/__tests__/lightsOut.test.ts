import { describe, expect, it } from 'vitest';
import { affected, isSolved, press, seedBoard, SIZE, solve } from '../puzzle/lightsOut';

/** Deterministic LCG so a failing seed is reproducible. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('lights out', () => {
  it('is configured for the gym s 3x3 board', () => {
    expect(SIZE).toBe(3);
  });

  it('toggles a panel and its orthogonal neighbours only', () => {
    // Centre of a 3x3 touches all four neighbours; a corner touches two.
    expect(affected(4).sort((a, b) => a - b)).toEqual([1, 3, 4, 5, 7]);
    expect(affected(0).sort((a, b) => a - b)).toEqual([0, 1, 3]);
    expect(affected(8).sort((a, b) => a - b)).toEqual([5, 7, 8]);
    // The solver still works at other sizes.
    expect(affected(5, 4).sort((a, b) => a - b)).toEqual([1, 4, 5, 6, 9]);
  });

  it('is involutive: pressing the same panel twice is a no-op', () => {
    const board = seedBoard(rng(7));
    expect(press(press(board, 4), 4)).toEqual(board);
  });

  it('produces seeds that are unsolved but always solvable', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const board = seedBoard(rng(seed));
      expect(board).toHaveLength(SIZE * SIZE);
      expect(isSolved(board), `seed ${seed} started solved`).toBe(false);

      const presses = solve(board);
      expect(presses, `seed ${seed} has no solution`).not.toBeNull();
      const solved = (presses as number[]).reduce((b, cell) => press(b, cell), board);
      expect(isSolved(solved), `seed ${seed} solution did not light the board`).toBe(true);
    }
  });

  it('still solves a 4x4 board, so the size is a parameter and not an assumption', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const board = seedBoard(rng(seed), 4);
      const presses = solve(board, 4);
      expect(presses).not.toBeNull();
      const solved = (presses as number[]).reduce((b, c) => press(b, c, 4), board);
      expect(isSolved(solved)).toBe(true);
    }
  });

  it('asks for no presses when the board is already lit', () => {
    expect(solve(new Array<boolean>(SIZE * SIZE).fill(true))).toEqual([]);
  });
});

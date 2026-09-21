/** Board edge length. The gym uses 3; the solver works for any size. */
export const SIZE = 3;
export const CELLS = SIZE * SIZE;

export function index(col: number, row: number, size = SIZE): number {
  return row * size + col;
}

/** Cells flipped by pressing one panel: itself plus its orthogonal neighbors. */
export function affected(cell: number, size = SIZE): number[] {
  const col = cell % size;
  const row = Math.floor(cell / size);
  const out = [cell];
  if (col > 0) out.push(index(col - 1, row, size));
  if (col < size - 1) out.push(index(col + 1, row, size));
  if (row > 0) out.push(index(col, row - 1, size));
  if (row < size - 1) out.push(index(col, row + 1, size));
  return out;
}

export function press(board: boolean[], cell: number, size = SIZE): boolean[] {
  const next = [...board];
  for (const i of affected(cell, size)) next[i] = !next[i];
  return next;
}

export function isSolved(board: boolean[]): boolean {
  return board.every(Boolean);
}

/**
 * Builds a board by pressing panels on an already-solved board, so the seed is
 * solvable by construction (the same presses undo it).
 */
export function seedBoard(rng: () => number = Math.random, size = SIZE): boolean[] {
  const cells = size * size;
  let board = new Array<boolean>(cells).fill(true);
  for (let guard = 0; guard < 200; guard++) {
    board = new Array<boolean>(cells).fill(true);
    const pressed = new Set<number>();
    const count = 1 + Math.floor(rng() * cells);
    for (let i = 0; i < count; i++) {
      const cell = Math.floor(rng() * cells);
      board = press(board, cell, size);
      pressed.has(cell) ? pressed.delete(cell) : pressed.add(cell);
    }
    // Pressing a panel twice cancels out, and quiet patterns in the null
    // space land right back on a solved board. Reject both.
    if (pressed.size >= 1 && !isSolved(board)) return board;
  }
  return board;
}

/**
 * Gaussian elimination over GF(2). Used by tests to assert a seed is solvable
 * and, if we ever want it, to produce a minimal-ish press set.
 */
export function solve(board: boolean[], size = SIZE): number[] | null {
  const cells = size * size;
  // rows[i] = which presses affect cell i, plus the target parity in bit `cells`.
  const rows: number[] = [];
  for (let cell = 0; cell < cells; cell++) {
    let row = 0;
    for (let p = 0; p < cells; p++) {
      if (affected(p, size).includes(cell)) row |= 1 << p;
    }
    // Target: flip every cell that is currently dark.
    if (!board[cell]) row |= 1 << cells;
    rows.push(row);
  }

  const pivotOf: number[] = [];
  let pivotRow = 0;
  for (let col = 0; col < cells && pivotRow < cells; col++) {
    const found = rows.findIndex((r, i) => i >= pivotRow && (r >> col) & 1);
    if (found === -1) continue;
    [rows[pivotRow], rows[found]] = [rows[found], rows[pivotRow]];
    for (let i = 0; i < cells; i++) {
      if (i !== pivotRow && (rows[i] >> col) & 1) rows[i] ^= rows[pivotRow];
    }
    pivotOf[col] = pivotRow;
    pivotRow++;
  }

  // Any all-zero row with a set target bit means no solution exists.
  for (const row of rows) {
    if ((row & ((1 << cells) - 1)) === 0 && (row >> cells) & 1) return null;
  }

  const presses: number[] = [];
  for (let col = 0; col < cells; col++) {
    const r = pivotOf[col];
    if (r !== undefined && (rows[r] >> cells) & 1) presses.push(col);
  }
  return presses;
}

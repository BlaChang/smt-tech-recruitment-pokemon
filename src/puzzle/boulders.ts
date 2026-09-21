import { DIRECTION_DELTA, type Direction } from '../world/direction';

export interface Boulder {
  x: number;
  y: number;
}

export interface BoulderState {
  boulders: Boulder[];
  /** Squares a boulder has to end up on. */
  sockets: Array<{ x: number; y: number }>;
}

export type Passable = (x: number, y: number) => boolean;

export function boulderAt(state: BoulderState, x: number, y: number): Boulder | undefined {
  return state.boulders.find((b) => b.x === x && b.y === y);
}

export function isSocket(state: BoulderState, x: number, y: number): boolean {
  return state.sockets.some((s) => s.x === x && s.y === y);
}

export function isSeated(state: BoulderState, boulder: Boulder): boolean {
  return isSocket(state, boulder.x, boulder.y);
}

/** Solved when every socket has a boulder sitting in it. */
export function isSolved(state: BoulderState): boolean {
  return state.sockets.every((s) => state.boulders.some((b) => b.x === s.x && b.y === s.y));
}

/**
 * Tries to shove the boulder on (x,y) one square in `facing`.
 *
 * Returns true if it moved. A boulder only slides when the square beyond it is
 * open terrain and holds no other boulder, which is what makes the layout a
 * puzzle rather than a shoving match.
 */
export function push(
  state: BoulderState,
  x: number,
  y: number,
  facing: Direction,
  passable: Passable,
): boolean {
  const boulder = boulderAt(state, x, y);
  if (!boulder) return false;

  const { dx, dy } = DIRECTION_DELTA[facing];
  const nextX = boulder.x + dx;
  const nextY = boulder.y + dy;

  if (!passable(nextX, nextY)) return false;
  if (boulderAt(state, nextX, nextY)) return false;

  boulder.x = nextX;
  boulder.y = nextY;
  return true;
}

/** Puts every boulder back where it started, for the reset switch. */
export function reset(state: BoulderState, starts: Array<{ x: number; y: number }>): void {
  state.boulders = starts.map((s) => ({ ...s }));
}

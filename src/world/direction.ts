export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/** The tile one step ahead of a position in the given facing. */
export function tileInFront(x: number, y: number, facing: Direction): { x: number; y: number } {
  const { dx, dy } = DIRECTION_DELTA[facing];
  return { x: x + dx, y: y + dy };
}

/** Which way an entity at (ax,ay) must face to look at (bx,by). */
export function facingToward(ax: number, ay: number, bx: number, by: number): Direction {
  if (Math.abs(bx - ax) > Math.abs(by - ay)) return bx > ax ? 'right' : 'left';
  return by > ay ? 'down' : 'up';
}

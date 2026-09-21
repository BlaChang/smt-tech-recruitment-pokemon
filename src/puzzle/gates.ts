import { DIRECTION_DELTA, type Direction } from '../world/direction';

/**
 * Rotating gates, in the spirit of the Fortree City gym.
 *
 * A gate is a hub with arms sticking out of it. Walking into an arm spins the
 * whole gate a quarter turn and lets you through the square the arm just left.
 * The arms block movement, so the puzzle is working out which gate to turn,
 * and from which side, to open a path.
 */

/** Arm directions, clockwise. A gate can have any subset. */
export const ARM_ORDER: Direction[] = ['up', 'right', 'down', 'left'];

export interface Gate {
  id: string;
  /** Hub tile. The hub itself always blocks. */
  x: number;
  y: number;
  /** Which directions currently have an arm. */
  arms: Direction[];
}

export function rotateDirection(dir: Direction, steps: number): Direction {
  const i = ARM_ORDER.indexOf(dir);
  return ARM_ORDER[(((i + steps) % 4) + 4) % 4];
}

/** Absolute squares occupied by a gate's arms. */
export function armTiles(gate: Gate): Array<{ x: number; y: number; dir: Direction }> {
  return gate.arms.map((dir) => {
    const { dx, dy } = DIRECTION_DELTA[dir];
    return { x: gate.x + dx, y: gate.y + dy, dir };
  });
}

/** The gate occupying a square, either by its hub or one of its arms. */
export function gateAt(gates: Gate[], x: number, y: number): Gate | undefined {
  return gates.find(
    (g) => (g.x === x && g.y === y) || armTiles(g).some((a) => a.x === x && a.y === y),
  );
}

export function hubAt(gates: Gate[], x: number, y: number): Gate | undefined {
  return gates.find((g) => g.x === x && g.y === y);
}

export interface PushResult {
  /** The gate that turned, if any. */
  gate?: Gate;
  /** Quarter turns applied: +1 clockwise, -1 counter-clockwise. */
  steps?: number;
  /** True when the player should step forward into the freed square. */
  advance: boolean;
}

/**
 * Walking from `fromDir` into the arm at (x,y).
 *
 * The arm swings away from the shove: pushing an arm sideways turns the gate
 * so that arm moves on, and the player takes its place. Pushing an arm
 * end-on (straight at the hub) does nothing, because there is nowhere for it
 * to give.
 */
export function pushArm(
  gates: Gate[],
  x: number,
  y: number,
  moving: Direction,
  blocked: (x: number, y: number) => boolean,
): PushResult {
  const gate = gates.find((g) => armTiles(g).some((a) => a.x === x && a.y === y));
  if (!gate) return { advance: false };

  const arm = armTiles(gate).find((a) => a.x === x && a.y === y);
  if (!arm) return { advance: false };

  // Pushing straight down the arm's own axis just jams it into the hub.
  const axisAligned = arm.dir === moving || arm.dir === rotateDirection(moving, 2);
  if (axisAligned) return { advance: false };

  // The arm gives way in the direction of travel: one quarter turn, sign
  // chosen so the pushed arm ends up out of the player's path.
  const steps = rotateDirection(arm.dir, 1) === moving ? 1 : -1;

  const rotated: Gate = { ...gate, arms: gate.arms.map((d) => rotateDirection(d, steps)) };
  // Refuse the turn if any arm would sweep into a wall.
  for (const a of armTiles(rotated)) {
    if (blocked(a.x, a.y)) return { advance: false };
  }

  gate.arms = rotated.arms;
  return { gate, steps, advance: true };
}

/** Solved when the player has reached the far side; the room decides that. */
export function gatesBlocking(gates: Gate[], x: number, y: number): boolean {
  return gateAt(gates, x, y) !== undefined;
}

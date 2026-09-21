import { TILE, TURN_DELAY_FRAMES, WALK_FRAMES } from '../engine/config';
import type { Input } from '../engine/input';
import { DIRECTION_DELTA, type Direction } from './direction';

export type WalkableCheck = (x: number, y: number) => boolean;

/** Emitted on the frame the player finishes arriving on a new tile. */
export interface StepEvent {
  x: number;
  y: number;
}

export class Player {
  tileX: number;
  tileY: number;
  facing: Direction;

  private moving = false;
  private progress = 0;
  private fromX = 0;
  private fromY = 0;
  private holdFrames = 0;
  /** Advances only while walking, so the sprite doesn't animate in place. */
  private animTicks = 0;

  constructor(x: number, y: number, facing: Direction = 'down') {
    this.tileX = x;
    this.tileY = y;
    this.fromX = x;
    this.fromY = y;
    this.facing = facing;
  }

  get isMoving(): boolean {
    return this.moving;
  }

  /** Interpolated top-left corner in world pixels. */
  get pixelX(): number {
    const t = this.moving ? this.progress / WALK_FRAMES : 1;
    return (this.fromX + (this.tileX - this.fromX) * t) * TILE;
  }

  get pixelY(): number {
    const t = this.moving ? this.progress / WALK_FRAMES : 1;
    return (this.fromY + (this.tileY - this.fromY) * t) * TILE;
  }

  /** 0 or 1: which foot is forward. */
  get walkFrame(): number {
    return this.moving ? Math.floor(this.animTicks / (WALK_FRAMES / 2)) % 2 : 0;
  }

  teleport(x: number, y: number, facing: Direction): void {
    this.tileX = this.fromX = x;
    this.tileY = this.fromY = y;
    this.facing = facing;
    this.moving = false;
    this.progress = 0;
  }

  update(input: Input, isWalkable: WalkableCheck): StepEvent | null {
    if (this.moving) {
      this.progress++;
      this.animTicks++;
      if (this.progress >= WALK_FRAMES) {
        this.moving = false;
        this.progress = 0;
        this.fromX = this.tileX;
        this.fromY = this.tileY;
        return { x: this.tileX, y: this.tileY };
      }
      return null;
    }

    const dir = readDirection(input);
    if (!dir) {
      this.holdFrames = 0;
      this.animTicks = 0;
      return null;
    }

    // Tapping a new direction turns in place without stepping, as in gen 3.
    if (dir !== this.facing) {
      this.facing = dir;
      this.holdFrames = 0;
      return null;
    }

    this.holdFrames++;
    if (this.holdFrames < TURN_DELAY_FRAMES) return null;

    const { dx, dy } = DIRECTION_DELTA[dir];
    const nextX = this.tileX + dx;
    const nextY = this.tileY + dy;
    if (!isWalkable(nextX, nextY)) {
      this.animTicks = 0;
      return null;
    }

    this.fromX = this.tileX;
    this.fromY = this.tileY;
    this.tileX = nextX;
    this.tileY = nextY;
    this.moving = true;
    this.progress = 0;
    return null;
  }
}

/** Last-pressed wins on a diagonal mash; ties fall back to a fixed order. */
function readDirection(input: Input): Direction | null {
  for (const dir of ['up', 'down', 'left', 'right'] as const) {
    if (input.pressed(dir)) return dir;
  }
  for (const dir of ['up', 'down', 'left', 'right'] as const) {
    if (input.down(dir)) return dir;
  }
  return null;
}

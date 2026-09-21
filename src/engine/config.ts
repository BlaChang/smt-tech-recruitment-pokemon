/** Logical screen is exactly one GBA panel; everything is integer-scaled from here. */
export const TILE = 16;
export const VIEW_W = 240;
export const VIEW_H = 160;

/** Frames to cross one tile. Gen-3 walking speed is 16; 8 feels better on a recruiting page. */
export const WALK_FRAMES = 8;

/** Frames a direction must be held before the player commits to a step (lets you turn in place). */
export const TURN_DELAY_FRAMES = 2;

export const FPS = 60;
export const MS_PER_FRAME = 1000 / FPS;

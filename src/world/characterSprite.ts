import { TILE } from '../engine/config';
import { assets } from '../engine/assets';
import type { Renderer } from '../engine/renderer';
import type { Direction } from './direction';

/** Row order in a standard 4-direction overworld sheet. */
const ROW: Record<Direction, number> = { down: 0, up: 1, left: 2, right: 3 };

/**
 * Draws a character from its sheet, or returns false if the art is missing so
 * the caller can fall back to its placeholder.
 *
 * `walkFrame` is 0 or 1; column 0 is the standing pose, so a walking character
 * alternates between the two step columns.
 */
export function drawCharacter(
  r: Renderer,
  key: string,
  x: number,
  y: number,
  facing: Direction,
  walkFrame: number,
  moving: boolean,
): boolean {
  const image = assets.get(key);
  const spec = assets.spec(key);
  if (!image || !spec) return false;

  const mirrored = spec.mirrorRight === true && facing === 'right';
  const row = mirrored ? ROW.left : ROW[facing];
  const col = moving ? 1 + (walkFrame % 2) : 0;

  // Sheets are taller than a tile; the overhang hangs above the occupied tile.
  const offsetY = spec.frameH - TILE;
  r.sprite(image, col * spec.frameW, row * spec.frameH, spec.frameW, spec.frameH, x, y - offsetY, false, mirrored);
  return true;
}

import type { MonSpec } from './teams';

/**
 * Whether a mon's art needs mirroring to face its opponent.
 *
 * There is one sprite per mon, used on both sides of the field: your GOOSE
 * and Calista's are the same image. Drawn as authored, the two combatants
 * can end up looking the same way, or both looking outward. The player's
 * side stands on the left and should face right; the foe's faces left.
 */
export function facesAway(spec: MonSpec, isFoe: boolean): boolean {
  const drawn = spec.faces ?? 'left';
  const wanted = isFoe ? 'left' : 'right';
  return drawn !== wanted;
}

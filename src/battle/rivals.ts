import { asRival, STARTERS, type MonSpec } from './teams';

/**
 * Every starter has a rival who fields the creature that beats it.
 *
 * The pairing is deliberate and symmetric: Francis (TECH) meets Goose (TD),
 * Goose (TD) meets BlobHeart (PW), BlobHeart (PW) meets Francis (TECH), and
 * in each case the type triangle favours the rival. Whichever starter a
 * candidate picks, their first real fight is uphill by exactly the same
 * margin -- so the choice stays a matter of taste rather than difficulty.
 */
export interface Rival {
  id: string;
  /** Display name, used in dialogue and on the battle box. */
  name: string;
  /** Overworld sprite slot; see tools/extract_overworld.py. */
  sprite: string;
  /** The starter they field against you. */
  monId: string;
  /** Said before the battle. */
  taunt: string;
  /** Said after you win. */
  defeated: string;
}

/** Keyed by the starter the player chose. */
export const RIVALS: Record<string, Rival> = {
  francis: {
    id: 'calista',
    name: 'CALISTA',
    sprite: 'rivalCalista',
    monId: 'goose',
    taunt: 'You took the penguin? Then you already know what beats it.',
    defeated: 'Huh. You out-shipped me. I want a rematch after the tournament.',
  },
  goose: {
    id: 'ritwin',
    name: 'RITWIN',
    sprite: 'rivalRitwin',
    monId: 'blobheart',
    taunt: 'A seagull. Bold. My red panda writes the problems your seagull announces.',
    defeated: 'Fine, fine. You earned that one. Go get the badge.',
  },
  blobheart: {
    id: 'blake',
    name: 'BLAKE',
    sprite: 'rivalBlake',
    monId: 'francis',
    taunt: 'The red panda? Cute. Cute does not survive a deploy.',
    defeated: 'Well. That is going in the retrospective. Well played.',
  },
};

/** The rival a given starter faces. Falls back to the first if unset. */
export function rivalFor(starterId: string | null): Rival {
  return RIVALS[starterId ?? ''] ?? RIVALS[STARTERS[0].id];
}

/** The single mon a rival fields, already handicapped. */
export function rivalTeam(rival: Rival): MonSpec[] {
  const spec = STARTERS.find((s) => s.id === rival.monId);
  if (!spec) throw new Error(`Rival ${rival.id} fields unknown mon ${rival.monId}`);
  return [asRival(spec)];
}

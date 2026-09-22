import type { Manifest } from '../engine/assets';
import { TILE } from '../engine/config';

/**
 * Every art slot the game will draw if the file exists. Anything absent falls
 * back to the placeholder rectangle it uses today, so art can land one PNG at
 * a time. See public/assets/README.md for the expected sheet layouts.
 */

/**
 * Overworld character sheets, 3 columns x 4 rows:
 *   cols: idle, step A, step B
 *   rows: down, up, left, right
 *
 * Frames are 16x24: a 16x16 body on the tile with an 8px head overhang above
 * it. `drawCharacter` derives that overhang from frameH, so a taller sheet
 * (16x32, say) needs no code change. Set mirrorRight for rips that ship only
 * a left-facing row; ours carries a real right row.
 */
const CHARACTER: Omit<Manifest[string], 'src'> = {
  frameW: 16,
  frameH: 24,
  mirrorRight: false,
};

export const CHARACTER_KEYS = [
  'player',
  'professor',
  'greeter',
  'scale',
  'build',
  'warstory',
  'wacky',
  'hint',
  'curator',
  'shipper',
  'rookie',
  'leader',
  'rivalCalista',
  'rivalRitwin',
  'rivalBlake',
] as const;

export type CharacterKey = (typeof CHARACTER_KEYS)[number];

/** Emerald UI panels, extracted by tools/extract_ui.py. */
export const UI_KEYS = [
  'message', 'panel', 'fightMoves', 'fightInfo', 'databoxPlayer', 'databoxFoe', 'hpFill',
  'numbers', 'font', 'portraitProfessor', 'bbBg', 'bbBase0', 'bbBase1',
  'trainerCalista', 'trainerRitwin', 'trainerBlake', 'trainerArpit',
] as const;

/** Battle portraits: one frame, no animation. */
export const MON_KEYS = [
  'blobheart', 'goose', 'francis', 'maytrix', 'tesselation', 'pieuler',
] as const;

export const MANIFEST: Manifest = {
  ...Object.fromEntries(
    CHARACTER_KEYS.map((key) => [`char:${key}`, { src: `assets/characters/${key}.png`, ...CHARACTER }]),
  ),
  // 64x64 is the GBA's own battle-sprite size, and this canvas is exactly a
  // GBA panel. Sprites are bottom-aligned on their platform, so leave no empty
  // rows below the creature's feet.
  ...Object.fromEntries(
    MON_KEYS.map((key) => [`mon:${key}`, { src: `assets/mons/${key}.png`, frameW: 64, frameH: 64 }]),
  ),
  // One atlas for the whole gym; TILES maps each map character into it.
  tileset: { src: 'assets/tiles/gym.png', frameW: TILE, frameH: TILE },

  // Emerald UI panels. Sizes come from src/content/uiAtlas.json at draw time;
  // the loader only needs to fetch the images.
  ...Object.fromEntries(
    UI_KEYS.map((key) => [`ui:${key}`, { src: `assets/ui/${key}.png`, frameW: 0, frameH: 0 }]),
  ),
};

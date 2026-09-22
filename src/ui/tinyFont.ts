/**
 * A 3x5 pixel font, for text that has to be smaller than the game's own.
 *
 * The Emerald font has exactly one crisp size. It is a pixel face that only
 * rasterises cleanly on its design grid: baked at 15 it produces zero
 * midtone pixels, and every other size from 5 to 16 produces thousands,
 * which is the blur the bitmap atlas exists to remove. So "smaller" cannot
 * come from scaling that font down -- it has to be a different face.
 *
 * Three pixels wide is uppercase-only by nature, which suits what this is
 * for: fine print at the bottom of the title screen. Anything a player
 * actually needs to read still uses the Emerald font.
 */

const W = 3;
const H = 5;
/** One blank column after each glyph. */
const ADVANCE = W + 1;

/**
 * Five 3-character rows per glyph, so a shape can be read and edited in
 * place. `#` is ink. Characters not listed draw as a gap.
 */
const SHAPES: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['#.#', '###', '###', '###', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  '.': ['...', '...', '...', '...', '.#.'],
  ',': ['...', '...', '...', '.#.', '#..'],
  "'": ['.#.', '.#.', '...', '...', '...'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  '-': ['...', '...', '###', '...', '...'],
  '(': ['..#', '.#.', '.#.', '.#.', '..#'],
  ')': ['#..', '.#.', '.#.', '.#.', '#..'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '&': ['.#.', '#.#', '.#.', '#.#', '.##'],
};

/** Width in pixels of `text`, excluding the trailing gap. */
export function measureTiny(text: string): number {
  if (!text.length) return 0;
  return text.length * ADVANCE - 1;
}

export const TINY_HEIGHT = H;

/** Cached strips: the shapes are static and this redraws every frame. */
const cache = new Map<string, HTMLCanvasElement>();

function strip(text: string, color: string): HTMLCanvasElement | null {
  const key = `${color}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, measureTiny(text));
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = color;
  for (let i = 0; i < text.length; i++) {
    const shape = SHAPES[text[i].toUpperCase()];
    if (!shape) continue;
    for (let row = 0; row < H; row++) {
      for (let col = 0; col < W; col++) {
        if (shape[row][col] === '#') ctx.fillRect(i * ADVANCE + col, row, 1, 1);
      }
    }
  }
  cache.set(key, canvas);
  return canvas;
}

/** Draws `text` with its left edge at x and its top at y. */
export function drawTiny(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
): void {
  const art = strip(text, color);
  if (art) ctx.drawImage(art, Math.round(x), Math.round(y));
}

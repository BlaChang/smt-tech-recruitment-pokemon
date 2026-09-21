import { assets } from '../engine/assets';
import METRICS from '../content/fontMetrics.json';

/**
 * The Emerald pixel font, blitted from a pre-baked atlas.
 *
 * Canvas fillText anti-aliases, which is why every label used to look soft
 * next to the HP readout: that readout was already blitting Emerald's own
 * digit strip. This draws all text the same way, so nothing is resampled.
 */

interface FontMetrics {
  cellW: number;
  cellH: number;
  first: number;
  perRow: number;
  advances: number[];
  capTop: number;
  capHeight: number;
  space: number;
  missing: string;
}

const M = METRICS as FontMetrics;

/** Glyphs this font does not define, mapped to something it does. */
const SUBSTITUTIONS: Record<string, string> = {
  '—': '-', // em dash
  '–': '-', // en dash
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '…': '...',
  '→': '>',
  '↗': '>',
};

/** Tinting is done once per colour and cached; there are only a handful. */
const tinted = new Map<string, HTMLCanvasElement>();

export function fontReady(): boolean {
  return assets.get('ui:font') !== null;
}

/** Visible height of an uppercase line, for laying out rows. */
export const CAP_HEIGHT = M.capHeight;
/** Distance from a drawn y to the top of the uppercase ink. */
export const CAP_TOP = M.capTop;

function normalise(text: string): string {
  let out = '';
  for (const ch of text) {
    const sub = SUBSTITUTIONS[ch];
    if (sub !== undefined) {
      out += sub;
      continue;
    }
    const code = ch.codePointAt(0) ?? 32;
    // Anything outside the baked range, or blanked as missing, becomes a space.
    if (code < M.first || code > M.first + M.advances.length - 1) out += ' ';
    else if (M.missing.includes(ch)) out += ' ';
    else out += ch;
  }
  return out;
}

export function measureText(text: string, scale = 1): number {
  let w = 0;
  for (const ch of normalise(text)) {
    w += M.advances[(ch.codePointAt(0) ?? 32) - M.first] ?? M.space;
  }
  return w * scale;
}

/**
 * A bitmap font only has one size, so a requested pixel height becomes the
 * nearest whole multiple. Anything else would resample and reintroduce the
 * blur this font exists to remove.
 */
export function scaleFor(requestedHeight: number): number {
  return Math.max(1, Math.round(requestedHeight / M.capHeight));
}

/** White atlas recoloured to `color`, built once and reused. */
function atlasFor(color: string): HTMLCanvasElement | null {
  const source = assets.get('ui:font');
  if (!source) return null;

  const cached = tinted.get(color);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  // Keep the glyph shapes, replace their colour.
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  tinted.set(color, canvas);
  return canvas;
}

/**
 * Draws text at (x, y), where y is the top of the uppercase ink rather than
 * the font's ascent line, so callers can position by what they can see.
 * Returns the advance width. No-ops to false if the atlas has not loaded.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
): boolean {
  const atlas = atlasFor(color);
  if (!atlas) return false;

  let cursor = Math.round(x);
  const top = Math.round(y) - M.capTop * scale;
  const w = M.cellW * scale;
  const h = M.cellH * scale;

  for (const ch of normalise(text)) {
    const index = (ch.codePointAt(0) ?? 32) - M.first;
    const advance = (M.advances[index] ?? M.space) * scale;
    if (ch !== ' ') {
      const col = index % M.perRow;
      const row = Math.floor(index / M.perRow);
      ctx.drawImage(
        atlas,
        col * M.cellW, row * M.cellH, M.cellW, M.cellH,
        cursor, top, w, h,
      );
    }
    cursor += advance;
  }
  return true;
}

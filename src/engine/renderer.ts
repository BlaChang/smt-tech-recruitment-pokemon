import { VIEW_H, VIEW_W } from './config';
import { drawText, measureText, fontReady, scaleFor } from '../ui/bitmapFont';

/**
 * Canvas wrapper. All draw calls are in world pixels and shifted by the camera;
 * pass `screen: true` for HUD-space drawing that should ignore the camera.
 */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  camX = 0;
  camY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.textBaseline = 'top';
  }

  /** Scale the canvas to the largest whole multiple that still fits the window. */
  fitToWindow(): void {
    const scale = Math.max(
      1,
      Math.floor(Math.min((window.innerWidth - 32) / VIEW_W, (window.innerHeight - 96) / VIEW_H)),
    );
    this.canvas.style.width = `${VIEW_W * scale}px`;
    this.canvas.style.height = `${VIEW_H * scale}px`;
  }

  /** Center on a world point, clamped so the camera never shows past the map edge. */
  centerOn(x: number, y: number, mapW: number, mapH: number): void {
    this.camX = Math.round(clamp(x - VIEW_W / 2, 0, Math.max(0, mapW - VIEW_W)));
    this.camY = Math.round(clamp(y - VIEW_H / 2, 0, Math.max(0, mapH - VIEW_H)));
  }

  /** A one-pixel line, for diagrams. Screen space only. */
  line(x1: number, y1: number, x2: number, y2: number, color: string): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    // Half-pixel offsets keep a 1px stroke on the pixel grid.
    this.ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
    this.ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
    this.ctx.stroke();
  }

  clear(color = '#000'): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  rect(x: number, y: number, w: number, h: number, color: string, screen = false): void {
    const [dx, dy] = screen ? [x, y] : [x - this.camX, y - this.camY];
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(dx), Math.round(dy), w, h);
  }

  strokeRect(x: number, y: number, w: number, h: number, color: string, screen = false): void {
    const [dx, dy] = screen ? [x, y] : [x - this.camX, y - this.camY];
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    // Half-pixel offset keeps a 1px stroke on the pixel grid instead of straddling it.
    this.ctx.strokeRect(Math.round(dx) + 0.5, Math.round(dy) + 0.5, w - 1, h - 1);
  }

  /**
   * Draws a nine-slice frame: corners stay pixel-exact, edges and middle
   * repeat to fill. This is how a 256px-wide Essentials panel becomes a
   * 240px one without resampling it to mush.
   */
  nineSlice(
    image: HTMLImageElement,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    inset: readonly number[],
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const [l, r, t, b] = inset;
    const midW = sw - l - r;
    const midH = sh - t - b;
    const destMidW = Math.max(0, w - l - r);
    const destMidH = Math.max(0, h - t - b);
    const dx = Math.round(x);
    const dy = Math.round(y);

    const blit = (
      ssx: number, ssy: number, ssw: number, ssh: number,
      ddx: number, ddy: number, ddw: number, ddh: number,
    ): void => {
      if (ssw <= 0 || ssh <= 0 || ddw <= 0 || ddh <= 0) return;
      this.ctx.drawImage(image, ssx, ssy, ssw, ssh, ddx, ddy, ddw, ddh);
    };

    // corners
    blit(sx, sy, l, t, dx, dy, l, t);
    blit(sx + sw - r, sy, r, t, dx + w - r, dy, r, t);
    blit(sx, sy + sh - b, l, b, dx, dy + h - b, l, b);
    blit(sx + sw - r, sy + sh - b, r, b, dx + w - r, dy + h - b, r, b);
    // edges
    blit(sx + l, sy, midW, t, dx + l, dy, destMidW, t);
    blit(sx + l, sy + sh - b, midW, b, dx + l, dy + h - b, destMidW, b);
    blit(sx, sy + t, l, midH, dx, dy + t, l, destMidH);
    blit(sx + sw - r, sy + t, r, midH, dx + w - r, dy + t, r, destMidH);
    // middle
    blit(sx + l, sy + t, midW, midH, dx + l, dy + t, destMidW, destMidH);
  }

  /**
   * World space by default, matching `rect`. Pass `screen: true` for HUD and
   * menu text. Getting this wrong is loud rather than subtle: screen text
   * drawn in world space scrolls away with the camera.
   */
  /**
   * Blits one frame out of a sheet. World space unless `screen` is set, and
   * `flip` mirrors horizontally for rips that omit a right-facing row.
   */
  sprite(
    image: HTMLImageElement,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    x: number,
    y: number,
    screen = false,
    flip = false,
    dw = sw,
    dh = sh,
  ): void {
    const dx = Math.round(screen ? x : x - this.camX);
    const dy = Math.round(screen ? y : y - this.camY);
    if (!flip) {
      this.ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
      return;
    }
    this.ctx.save();
    this.ctx.translate(dx + dw, dy);
    this.ctx.scale(-1, 1);
    this.ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
    this.ctx.restore();
  }

  text(str: string, x: number, y: number, color = '#20202c', size = 8, screen = false): void {
    const [dx, dy] = screen ? [x, y] : [x - this.camX, y - this.camY];
    if (drawText(this.ctx, str, dx, dy, color, scaleFor(size))) return;

    // Before the atlas loads, fall back to the browser font.
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px ui-monospace, Menlo, monospace`;
    this.ctx.fillText(str, Math.round(dx), Math.round(dy));
  }

  textCentered(
    str: string,
    centerX: number,
    y: number,
    color = '#20202c',
    size = 8,
    screen = false,
  ): void {
    this.text(str, centerX - this.measure(str, size) / 2, y, color, size, screen);
  }

  measure(str: string, size = 8): number {
    if (fontReady()) return measureText(str, scaleFor(size));
    this.ctx.font = `${size}px ui-monospace, Menlo, monospace`;
    return this.ctx.measureText(str).width;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

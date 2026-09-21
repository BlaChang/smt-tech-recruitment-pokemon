import { VIEW_H, VIEW_W } from '../engine/config';
import type { Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { audio } from '../engine/audio';
import { drawPlainFrame, drawShadowText, drawUiFrame, INK_DARK } from './frame';

export type MenuAnchor = 'above-textbox' | 'center' | 'lower-center';

const LINE_H = 11;
const PAD = 9;

/**
 * Vertical cursor list used for dialogue branches and battle move select.
 * Sits bottom-right above the text box by default.
 */
export class Menu {
  visible = false;
  index = 0;
  private options: string[] = [];
  private anchor: MenuAnchor = 'above-textbox';
  private cancellable = false;

  open(options: string[], opts: { anchor?: MenuAnchor; cancellable?: boolean } = {}): void {
    this.options = options;
    this.index = 0;
    this.visible = true;
    this.anchor = opts.anchor ?? 'above-textbox';
    this.cancellable = opts.cancellable ?? false;
  }

  close(): void {
    this.visible = false;
  }

  /** Returns the chosen index, -1 if cancelled, or null while still open. */
  update(input: Input): number | null {
    if (!this.visible) return null;

    if (input.pressed('up') || input.pressed('down')) {
      const step = input.pressed('up') ? this.options.length - 1 : 1;
      this.index = (this.index + step) % this.options.length;
      audio.play('cursor', 0.7);
    }

    if (input.pressed('a')) {
      input.consume('a');
      audio.play('select');
      this.close();
      return this.index;
    }
    if (this.cancellable && input.pressed('b')) {
      this.close();
      return -1;
    }
    return null;
  }

  private box(r: Renderer): { x: number; y: number; w: number; h: number } {
    const w = Math.max(...this.options.map((o) => r.measure(o))) + PAD * 2 + 12;
    const h = this.options.length * LINE_H + PAD * 2 - 2;
    if (this.anchor === 'center') {
      return { x: Math.round((VIEW_W - w) / 2), y: Math.round((VIEW_H - h) / 2), w, h };
    }
    if (this.anchor === 'lower-center') {
      return { x: Math.round((VIEW_W - w) / 2), y: VIEW_H - h - 34, w, h };
    }
    return { x: VIEW_W - w - 6, y: VIEW_H - 54 - h - 2, w, h };
  }

  render(r: Renderer): void {
    if (!this.visible) return;
    const { x, y, w, h } = this.box(r);
    const emerald = drawUiFrame(r, 'panel', x, y, w, h);
    if (!emerald) drawPlainFrame(r, x, y, w, h);

    this.options.forEach((option, i) => {
      const oy = y + PAD + i * LINE_H;
      if (i === this.index) {
        if (emerald) drawShadowText(r, '>', x + PAD, oy, '#ffb04a');
        else r.text('>', x + PAD, oy, '#c2452f', 8, true);
      }
      if (emerald) drawShadowText(r, option, x + PAD + 10, oy);
      else r.text(option, x + PAD + 10, oy, INK_DARK, 8, true);
    });
  }
}

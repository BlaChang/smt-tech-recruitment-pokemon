import { VIEW_H, VIEW_W } from '../engine/config';
import type { Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { audio } from '../engine/audio';
import { drawPlainFrame, drawShadowText, drawUiFrame, INK_DARK } from './frame';

const BOX_X = 4;
const BOX_W = VIEW_W - 8;
const BOX_H = 50;
const BOX_Y = VIEW_H - BOX_H - 4;
/**
 * Horizontal padding clears the frame's 13px border; vertical padding is
 * tighter so three lines of the 15px-cell font still fit inside the box.
 */
const PAD_X = 14;
const PAD_Y = 9;
/**
 * The name plate reuses the message frame, so it cannot be shorter than that
 * frame's own borders (9 top + 7 bottom) or the rounded ends collapse.
 */
const PLATE_H = 20;
const LINE_H = 11;
const LINES_PER_PAGE = 3;
/** Characters revealed per frame; ~3.5 lines/second reads comfortably. */
const TYPE_SPEED = 0.75;

export class TextBox {
  visible = false;
  private pages: string[][] = [];
  private page = 0;
  private revealed = 0;
  private speaker?: string;
  private blink = 0;

  show(text: string, renderer: Renderer, speaker?: string): void {
    this.pages = paginate(text, renderer, BOX_W - PAD_X * 2, LINES_PER_PAGE);
    this.page = 0;
    this.revealed = 0;
    this.speaker = speaker;
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
    this.pages = [];
  }

  private get pageText(): string {
    return (this.pages[this.page] ?? []).join('\n');
  }

  private get pageDone(): boolean {
    return this.revealed >= this.pageText.length;
  }

  /** Returns true on the frame the final page is dismissed. */
  update(input: Input): boolean {
    if (!this.visible) return false;
    this.blink++;

    // Read both before consuming: consume('a') makes pressed('a') false.
    const pressedA = input.pressed('a');
    const advance = pressedA || input.pressed('b');
    if (pressedA) input.consume('a');

    if (!this.pageDone) {
      // Mid-typewriter, a press only dumps the rest of the page. That is a
      // fast-forward rather than a page turn, so it stays silent.
      this.revealed = advance ? this.pageText.length : this.revealed + TYPE_SPEED;
      return false;
    }

    if (!advance) return false;

    // Past this point the text genuinely moves on. Only A is announced; B
    // advances quietly.
    if (pressedA) audio.play('text');

    if (this.page < this.pages.length - 1) {
      this.page++;
      this.revealed = 0;
      return false;
    }

    this.hide();
    return true;
  }

  render(r: Renderer): void {
    if (!this.visible) return;
    const emerald = drawUiFrame(r, 'message', BOX_X, BOX_Y, BOX_W, BOX_H);
    if (!emerald) drawPlainFrame(r, BOX_X, BOX_Y, BOX_W, BOX_H);

    const lines = this.pages[this.page] ?? [];
    let budget = Math.floor(this.revealed);
    let y = BOX_Y + PAD_Y;

    if (this.speaker) {
      const w = r.measure(this.speaker) + PAD_X * 2;
      const py = BOX_Y - PLATE_H - 1;
      if (!drawUiFrame(r, 'panel', BOX_X, py, w, PLATE_H)) {
        drawPlainFrame(r, BOX_X, py, w, PLATE_H);
      }
      this.line(r, this.speaker, BOX_X + PAD_X, py + 6, emerald);
    }

    for (const line of lines) {
      if (budget <= 0) break;
      this.line(r, line.slice(0, budget), BOX_X + PAD_X, y, emerald);
      budget -= line.length + 1; // +1 for the newline consumed between lines
      y += LINE_H;
    }

    // Blinking "more" arrow, only once the page has fully typed out.
    if (this.pageDone && Math.floor(this.blink / 24) % 2 === 0) {
      const ax = BOX_X + BOX_W - 15;
      const ay = BOX_Y + BOX_H - 13;
      const tint = emerald ? '#f8f8f8' : '#3a3f66';
      r.rect(ax, ay, 5, 1, tint, true);
      r.rect(ax + 1, ay + 1, 3, 1, tint, true);
      r.rect(ax + 2, ay + 2, 1, 1, tint, true);
    }
  }

  /** Light-on-teal for the Emerald panel, dark ink for the plain fallback. */
  private line(r: Renderer, text: string, x: number, y: number, emerald: boolean): void {
    if (emerald) drawShadowText(r, text, x, y);
    else r.text(text, x, y, INK_DARK, 8, true);
  }
}

/** Greedy word wrap, then slice into fixed-height pages. Honors explicit \n. */
export function paginate(
  text: string,
  renderer: Renderer,
  maxWidth: number,
  linesPerPage: number,
): string[][] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let current = '';
    for (const word of paragraph.split(' ')) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && renderer.measure(candidate) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }

  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  return pages.length ? pages : [['']];
}

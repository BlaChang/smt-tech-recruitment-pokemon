import { VIEW_H, VIEW_W } from '../engine/config';
import type { Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import type { Scene } from '../engine/scenes';
import { audio } from '../engine/audio';
import { Menu } from './menu';

/**
 * Footer rows, stacked to the bottom edge.
 *
 * 148 is as low as the last line goes: the font cell is 15px tall and sits
 * 3px above the baseline anchor, so 148 puts its descenders exactly on 160.
 *
 * The disclaimer cannot be made smaller than the lines above it. The
 * Emerald font has one crisp size -- it is a pixel face that only
 * rasterises cleanly at 15, so `size` only ever picks a whole multiple of
 * it, and anything under 13 is the same scale 1. A separate smaller face
 * does not work either: below five columns a glyph has no centre column,
 * and M, N and W become mutually unreadable. It reads as fine print by
 * being last and dim instead.
 */
const CONTROLS_Y = 120;
const SOUND_Y = 134;
const DISCLAIMER_Y = 148;

export interface TitleDeps {
  hasSave: boolean;
  onStart(continueSave: boolean): void;
}

export class TitleScene implements Scene {
  private menu = new Menu();
  private ticks = 0;

  constructor(private deps: TitleDeps) {}

  onEnter(): void {
    audio.playMusic('menu');
    this.menu.open(this.deps.hasSave ? ['CONTINUE', 'NEW CHALLENGE'] : ['CHALLENGE THE GYM'], {
      anchor: 'lower-center',
    });
  }

  update(input: Input): void {
    this.ticks++;
    const picked = this.menu.update(input);
    if (picked === null || picked < 0) return;
    this.deps.onStart(this.deps.hasSave && picked === 0);
  }

  render(r: Renderer): void {
    r.clear('#141225');
    for (let i = 0; i < VIEW_H; i += 4) {
      r.rect(0, i, VIEW_W, 1, 'rgba(255,212,94,0.035)', true);
    }

    r.textCentered('STANFORD MATH TOURNAMENT', VIEW_W / 2, 22, '#8f9ad0', 8, true);
    r.textCentered('TECH GYM', VIEW_W / 2, 38, '#ffd45e', 20, true);
    r.textCentered('a recruitment, disguised as a gym', VIEW_W / 2, 62, '#6f7aa8', 8, true);

    this.menu.render(r);

    if (Math.floor(this.ticks / 30) % 2 === 0) {
      r.textCentered('Arrows to Move, Space to talk', VIEW_W / 2, CONTROLS_Y, '#4e5680', 8, true);
    }
    r.textCentered('Turn on sound for the full experience', VIEW_W / 2, SOUND_Y, '#8f9ad0', 8, true);
    r.textCentered(
      'totally not a ripoff of Pokemon Emerald',
      VIEW_W / 2, DISCLAIMER_Y, '#3f4668', 8, true,
    );
  }
}

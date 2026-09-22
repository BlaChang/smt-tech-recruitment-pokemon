import { VIEW_H, VIEW_W } from '../engine/config';
import type { Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import type { Scene } from '../engine/scenes';
import { audio } from '../engine/audio';
import { Menu } from './menu';
import { drawTiny, measureTiny, TINY_HEIGHT } from './tinyFont';

/** Uppercase because the 3x5 face has no lowercase; see tinyFont.ts. */
const DISCLAIMER = 'TOTALLY NOT A RIPOFF OF POKEMON EMERALD';

/** Footer rows. The last is measured from the bottom so nothing clips off. */
const CONTROLS_Y = 122;
const SOUND_Y = 136;
const FINE_PRINT_Y = VIEW_H - TINY_HEIGHT - 4;

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

    // Fine print, in the 3x5 face: the Emerald font has one crisp size and
    // this has to sit under a line already written in it.
    const w = measureTiny(DISCLAIMER);
    drawTiny(r.ctx, DISCLAIMER, Math.round((VIEW_W - w) / 2), FINE_PRINT_Y, '#4a4f74');
  }
}

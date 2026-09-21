import { VIEW_H, VIEW_W } from '../engine/config';
import type { Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import type { Scene } from '../engine/scenes';
import { audio } from '../engine/audio';
import { Menu } from './menu';

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
    r.textCentered('a recruitment, disguised as a gym', VIEW_W / 2, 68, '#6f7aa8', 8, true);

    this.menu.render(r);

    if (Math.floor(this.ticks / 30) % 2 === 0) {
      r.textCentered('Arrows to move  Z to talk  X to back out', VIEW_W / 2, VIEW_H - 16, '#4e5680', 8, true);
    }
  }
}

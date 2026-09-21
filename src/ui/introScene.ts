import { VIEW_H, VIEW_W } from '../engine/config';
import type { Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import type { Scene } from '../engine/scenes';
import { INTRO } from '../content/intro';
import { ScriptRunner } from '../content/script';
import type { GameState } from '../state/gameState';
import { STARTERS } from '../battle/teams';
import { assets } from '../engine/assets';
import { audio } from '../engine/audio';
import { Menu } from './menu';
import { drawTypeTriangle } from './typeTriangle';

/** Where the lab floor starts; everyone in this scene stands on it. */
const FLOOR_Y = 86;

/** Starter line-up: scaled-down battle sprites standing on the lab floor. */
const PREVIEW_SIZE = 28;
/** The portrait hangs above the floor, clear of the starters standing on it. */
const PORTRAIT_BOTTOM = 56;
/** Set by the intro script while the type triangle should be on screen. */
export const TRIANGLE_FLAG = 'intro:types';
const PREVIEW_X = 6;
const PREVIEW_PITCH = 32;
import { TextBox } from './textbox';

export interface IntroDeps {
  renderer: Renderer;
  state: GameState;
  track(event: string, data?: Record<string, unknown>): void;
  askName(onDone: () => void): void;
  onDone(): void;
}

/**
 * Professor SymmeTREE's lab. No map, no player: just the professor, the three
 * starters, and the text box.
 */
export class IntroScene implements Scene {
  private textbox = new TextBox();
  private menu = new Menu();
  private runner: ScriptRunner;
  private ticks = 0;
  private finished = false;

  constructor(private deps: IntroDeps) {
    this.runner = new ScriptRunner({
      textbox: this.textbox,
      menu: this.menu,
      renderer: deps.renderer,
      state: deps.state,
      startBattle: () => {},
      startRivalBattle: () => {},
      openRegistry: () => {},
      askName: () => deps.askName(() => this.runner.resume()),
      track: (event, data) => deps.track(event, data),
    });
  }

  onEnter(): void {
    audio.playMusic('menu');
    this.runner.start(INTRO);
  }

  update(input: Input): void {
    this.ticks++;
    this.runner.update(input);
    if (!this.runner.running && !this.finished) {
      this.finished = true;
      this.deps.onDone();
    }
  }

  render(r: Renderer): void {
    r.clear('#1b1830');
    // Lab floor, so the professor is standing on something.
    r.rect(0, FLOOR_Y, VIEW_W, VIEW_H - FLOOR_Y, '#241f3d', true);
    r.rect(0, FLOOR_Y, VIEW_W, 1, '#3a3459', true);

    // While he is explaining matchups, the diagram takes his place.
    if (this.deps.state.flags.has(TRIANGLE_FLAG)) drawTypeTriangle(r, 42);
    else this.drawProfessor(r);
    this.drawStarters(r);

    // The speaker plate on the text box already names him; no caption needed.
    this.textbox.render(r);
    this.menu.render(r);
  }

  /**
   * Professor SymmeTREE.
   *
   * His art is a photo bust rather than a walking sprite, so he is presented
   * as a portrait floating above the lab floor. Standing a head-and-shoulders
   * cutout on the ground would read as a bust on the carpet, and it would
   * collide with the starter line-up that stands there.
   */
  private drawProfessor(r: Renderer): void {
    const bob = Math.floor(this.ticks / 40) % 2;

    const portrait = assets.get('ui:portraitProfessor');
    if (portrait) {
      const x = Math.round((VIEW_W - portrait.width) / 2);
      const y = PORTRAIT_BOTTOM - portrait.height + bob;
      r.sprite(portrait, 0, 0, portrait.width, portrait.height, x, y, true);
      return;
    }

    // Fall back to the overworld sprite, then to a drawn stand-in.
    const art = assets.get('char:professor');
    const spec = assets.spec('char:professor');
    if (art && spec) {
      const scale = 2;
      const w = spec.frameW * scale;
      const h = spec.frameH * scale;
      r.ctx.drawImage(
        art, 0, 0, spec.frameW, spec.frameH,
        Math.round((VIEW_W - w) / 2), Math.round(FLOOR_Y - h + bob), w, h,
      );
      return;
    }

    const x = VIEW_W / 2 - 14;
    const y = 26;
    r.rect(x + 2, y + 2 + bob, 24, 12, '#b9b9c8', true);
    r.rect(x + 5, y + 12 + bob, 18, 10, '#e8c9a8', true);
    r.rect(x, y + 22 + bob, 28, 34, '#f2f2f6', true);
    r.strokeRect(x, y + 22 + bob, 28, 34, '#3a3f66', true);
    r.rect(x + 12, y + 24 + bob, 4, 30, '#d8d8e4', true);
  }

  private drawStarters(r: Renderer): void {
    if (!this.menu.visible) return;

    STARTERS.forEach((starter, i) => {
      const x = PREVIEW_X + i * PREVIEW_PITCH;
      const selected = this.menu.index === i;
      const lift = selected ? 2 : 0;
      const feet = FLOOR_Y - lift;
      const centerX = x + PREVIEW_SIZE / 2;

      const art = assets.get(`mon:${starter.id}`);
      const spec = assets.spec(`mon:${starter.id}`);
      if (art && spec) {
        // Battle sprites are 64px; scale down so all three fit on the floor.
        r.sprite(
          art, 0, 0, spec.frameW, spec.frameH,
          x, feet - PREVIEW_SIZE, true, false, PREVIEW_SIZE, PREVIEW_SIZE,
        );
      } else {
        r.rect(x, feet - PREVIEW_SIZE, PREVIEW_SIZE, PREVIEW_SIZE, starter.color, true);
        r.strokeRect(x, feet - PREVIEW_SIZE, PREVIEW_SIZE, PREVIEW_SIZE, '#3a3f66', true);
      }

      if (selected) {
        r.strokeRect(x - 2, feet - PREVIEW_SIZE - 2, PREVIEW_SIZE + 4, PREVIEW_SIZE + 4, '#ffd45e', true);
      }
      r.textCentered(starter.type, centerX, FLOOR_Y + 3, selected ? '#ffd45e' : '#6f7aa8', 8, true);
    });
  }
}


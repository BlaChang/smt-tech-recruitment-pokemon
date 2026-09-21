import { VIEW_H, VIEW_W } from '../engine/config';
import { assets } from '../engine/assets';
import { audio } from '../engine/audio';
import type { Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import type { Scene } from '../engine/scenes';
import type { GameState } from '../state/gameState';
import { Menu } from '../ui/menu';
import { TextBox } from '../ui/textbox';
import {
  drawNumber,
  drawPlainFrame,
  drawShadowText,
  drawUiFrame,
  numberWidth,
  UI_ATLAS,
} from '../ui/frame';
import { applyMove, chooseEnemyMove, createMon, healsLeft, isFainted, type MonState } from './engine';
import { move } from './moves';
import { randomQuestion, type MathQuestion } from './questions';
import { LEADER_TEAM, playerTeam, SHIELDED_MON_ID } from './teams';

/**
 * Field layout, sized for 64x64 combatants on a 240x160 panel. Each sprite is
 * bottom-aligned on its FEET line, so taller or shorter art still stands on
 * the platform instead of floating.
 */
const FOE_X = 148;
const FOE_FEET = 64;
const PLAYER_X = 14;
const PLAYER_FEET = 100;

/** A queued beat: text to read, a side effect to run, or a pause in frames. */
type Step = string | (() => void) | { wait: number };

type Phase = 'busy' | 'menu' | 'question' | 'done';

export interface BattleDeps {
  renderer: Renderer;
  state: GameState;
  track(event: string, data?: Record<string, unknown>): void;
  onEnd(won: boolean): void;
}

export class BattleScene implements Scene {
  private textbox = new TextBox();
  private menu = new Menu();
  private steps: Step[] = [];
  private waitFrames = 0;
  private phase: Phase = 'busy';

  private party: MonState[];
  private foes: MonState[];
  private partyIndex = 0;
  private foeIndex = 0;

  private question: MathQuestion | null = null;
  /** Cursor position in the 2x2 move grid. */
  private moveIndex = 0;
  /** Frames until the low-HP beep repeats. */
  private lowHpTimer = 0;
  private playerFlash = 0;
  private foeFlash = 0;
  private ticks = 0;

  constructor(private deps: BattleDeps) {
    this.party = playerTeam(deps.state.starter).map((spec) => createMon(spec));
    this.foes = LEADER_TEAM.map((spec) => createMon(spec, spec.id === SHIELDED_MON_ID));
  }

  private get active(): MonState {
    return this.party[this.partyIndex];
  }

  /**
   * The mon the player last fought with. Unlike `active`, this stays valid
   * after a loss, when partyIndex has already run past the end of the party.
   */
  private get lastActive(): MonState {
    return this.party[Math.min(this.partyIndex, this.party.length - 1)];
  }

  private get foe(): MonState {
    return this.foes[this.foeIndex];
  }

  onEnter(): void {
    audio.playMusic('battle');
    this.deps.state.battleTurns = 0;
    // Dev affordance: ?phase=menu drops straight into move select so the
    // fight panels can be inspected without playing through the intro.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('phase') === 'menu') {
      this.toMenu();
      return;
    }
    this.queue(
      `ARPIT sent out ${this.foe.spec.name}!`,
      this.foe.spec.sendLine ?? '',
      `Go, ${this.active.spec.name}!`,
      this.active.spec.sendLine ?? '',
      () => this.toMenu(),
    );
  }

  /** Popping the battle reveals the gym again, so its music comes back. */
  onExit(): void {
    audio.playMusic('gym');
  }

  private queue(...steps: Step[]): void {
    // Empty strings come from optional flavor lines; drop them rather than
    // showing a blank text box.
    this.steps.push(...steps.filter((s) => s !== ''));
  }

  update(input: Input): void {
    this.ticks++;
    if (this.playerFlash > 0) this.playerFlash--;
    if (this.foeFlash > 0) this.foeFlash--;
    this.updateLowHpWarning();

    if (this.pump(input)) return;

    if (this.phase === 'menu') {
      this.updateMoveGrid(input);
      return;
    }

    if (this.phase === 'question') {
      const picked = this.menu.update(input);
      if (picked !== null && picked >= 0) this.answerQuestion(picked);
    }
  }

  /**
   * The red-HP beep, repeating for as long as your mon is in danger.
   *
   * Only the player's side warns, as in the games: the point is to tell you
   * that *you* are about to lose, and doing it for both would be noise. The
   * clip carries its own trailing gap, so repeating it at its own length
   * gives a continuous beep rather than a stutter.
   */
  private updateLowHpWarning(): void {
    const mon = this.party[this.partyIndex];
    const inDanger =
      this.phase !== 'done' &&
      mon !== undefined &&
      mon.hp > 0 &&
      mon.hp / mon.spec.maxHp <= LOW_HP_RATIO;

    if (!inDanger) {
      // Reset so the warning sounds immediately next time, not mid-cycle.
      this.lowHpTimer = 0;
      return;
    }

    if (this.lowHpTimer <= 0) {
      audio.play('lowHp', 0.8);
      this.lowHpTimer = LOW_HP_INTERVAL;
    } else {
      this.lowHpTimer--;
    }
  }

  /** Drains the step queue. Returns true while something is still playing out. */
  private pump(input: Input): boolean {
    if (this.waitFrames > 0) {
      this.waitFrames--;
      return true;
    }
    if (this.textbox.visible) {
      if (!this.textbox.update(input)) return true;
    }
    while (this.steps.length > 0) {
      const step = this.steps.shift() as Step;
      if (typeof step === 'string') {
        this.textbox.show(step, this.deps.renderer);
        return true;
      }
      if (typeof step === 'function') {
        step();
        continue;
      }
      this.waitFrames = step.wait;
      return true;
    }
    return false;
  }

  private toMenu(): void {
    this.phase = 'menu';
    this.moveIndex = 0;
  }

  /** Move select is a 2x2 grid in Emerald, not a list, so it is driven here. */
  private updateMoveGrid(input: Input): void {
    const count = this.active.spec.moves.length;
    const moved =
      input.pressed('left') || input.pressed('right') || input.pressed('up') || input.pressed('down');
    if (input.pressed('left') || input.pressed('right')) this.moveIndex ^= 1;
    if (input.pressed('up') || input.pressed('down')) this.moveIndex ^= 2;
    this.moveIndex = Math.min(this.moveIndex, count - 1);
    if (moved) audio.play('cursor', 0.7);
    if (input.pressed('a')) {
      input.consume('a');
      audio.play('select');
      this.takeTurn(this.moveIndex);
    }
  }

  private takeTurn(moveIndex: number): void {
    this.phase = 'busy';
    this.deps.state.battleTurns++;
    const chosen = move(this.active.spec.moves[moveIndex]);

    this.queue(`${this.active.spec.name} used ${chosen.name}!`, () => {
      const messages = this.resolve(this.active, this.foe, chosen, true);
      this.steps.unshift(...messages, () => this.afterPlayerMove());
    });
  }

  private afterPlayerMove(): void {
    if (isFainted(this.foe)) {
      this.queue(`${this.foe.spec.name} crashed!`, () => this.advanceFoe());
      return;
    }
    this.enemyTurn();
  }

  private enemyTurn(): void {
    const moves = this.foe.spec.moves.map(move);
    const chosen = chooseEnemyMove(this.foe, moves);
    this.queue(`Foe ${this.foe.spec.name} used ${chosen.name}!`, () => {
      const messages = this.resolve(this.foe, this.active, chosen, false);
      this.steps.unshift(...messages, () => this.afterEnemyMove());
    });
  }

  private afterEnemyMove(): void {
    if (isFainted(this.active)) {
      this.queue(`${this.active.spec.name} crashed!`, () => this.advanceParty());
      return;
    }
    this.toMenu();
  }

  /** Applies a move and returns the lines describing what happened. */
  private resolve(attacker: MonState, defender: MonState, mv: ReturnType<typeof move>, byPlayer: boolean): string[] {
    const result = applyMove(attacker, defender, mv);
    const lines: string[] = [];

    if (result.missed) {
      audio.play('miss');
      lines.push(`${attacker.spec.name}'s ${mv.name} missed!`);
      return lines;
    }

    if (result.damage > 0) {
      if (byPlayer) this.foeFlash = 12;
      else this.playerFlash = 12;
      audio.play('hit', result.blockedByShield ? 0.5 : 1);
    }

    if (result.blockedByShield) {
      lines.push(`${defender.spec.name}'s SHIELD absorbed almost all of it!`);
    } else if (mv.flavor && result.damage > 0) {
      lines.push(mv.flavor);
    }

    // Only when HP actually came back: a spent heal reports "no patches left".
    if (result.healed > 0) audio.play('heal');
    // Likewise, a stat already at its floor reports "cannot go further".
    if (result.statChanged && mv.effect === 'debuff-attack') audio.play('debuff');

    if (result.statText) lines.push(result.statText);
    if (result.recoil > 0) lines.push(`${attacker.spec.name} took ${result.recoil} from the blast radius!`);

    return lines;
  }

  private advanceFoe(): void {
    this.foeIndex++;
    if (this.foeIndex >= this.foes.length) {
      this.finish(true);
      return;
    }
    this.queue(`ARPIT sent out ${this.foe.spec.name}!`, this.foe.spec.sendLine ?? '', () => {
      if (this.foe.shielded) this.askQuestion(true);
      else this.toMenu();
    });
  }

  private advanceParty(): void {
    this.partyIndex++;
    if (this.partyIndex >= this.party.length) {
      this.finish(false);
      return;
    }
    this.queue(`Go, ${this.active.spec.name}!`, this.active.spec.sendLine ?? '', () => this.toMenu());
  }

  private askQuestion(first: boolean): void {
    this.question = randomQuestion();
    this.queue(
      first
        ? 'ARPIT: That shield does not come down for force. It comes down for arithmetic.'
        : 'ARPIT: Not it. Try this one.',
      this.question.prompt,
      () => {
        this.phase = 'question';
        this.menu.open(this.question?.options ?? [], { anchor: 'center' });
      },
    );
  }

  private answerQuestion(picked: number): void {
    this.phase = 'busy';
    const question = this.question;
    if (!question) return;

    this.deps.state.mathAttempts++;

    if (picked === question.answer) {
      this.deps.track('math:correct', { attempts: this.deps.state.mathAttempts });
      this.queue(
        `ARPIT: ${question.reward}`,
        () => {
          this.foe.shielded = false;
          this.foeFlash = 20;
        },
        `${this.foe.spec.name}'s SHIELD shattered!`,
        () => this.toMenu(),
      );
      return;
    }

    // Never a dead end: a wrong answer costs a turn, then a fresh question.
    this.deps.track('math:wrong', { attempts: this.deps.state.mathAttempts });
    this.queue('ARPIT: No. And that hesitation cost you.', () => {
      const moves = this.foe.spec.moves.map(move);
      const chosen = chooseEnemyMove(this.foe, moves);
      this.steps.unshift(
        `Foe ${this.foe.spec.name} used ${chosen.name}!`,
        () => {
          const messages = this.resolve(this.foe, this.active, chosen, false);
          this.steps.unshift(...messages, () => {
            if (isFainted(this.active)) {
              this.queue(`${this.active.spec.name} crashed!`, () => this.advanceParty());
            } else {
              this.askQuestion(false);
            }
          });
        },
      );
    });
  }

  private finish(won: boolean): void {
    this.phase = 'done';
    this.deps.state.battleWon = this.deps.state.battleWon || won;
    this.deps.track(won ? 'battle:won' : 'battle:lost', {
      turns: this.deps.state.battleTurns,
      mathAttempts: this.deps.state.mathAttempts,
    });
    if (won) audio.play('badge');
    this.queue(
      won ? 'ARPIT is out of usable mons!' : `${this.lastActive.spec.name} cannot continue...`,
      won
        ? `${this.deps.state.playerName || 'You'} beat the SMT GYM!`
        : 'You are out of the running... for about thirty seconds. Nothing is lost.',
      () => this.deps.onEnd(won),
    );
  }

  render(r: Renderer): void {
    r.clear('#f0ead6');
    r.rect(0, 0, VIEW_W, 66, '#9fd0e8', true);
    // Platforms sit directly under each combatant's feet, centred on a
    // full-width 64px sprite.
    r.rect(FOE_X - 8, FOE_FEET - 2, 80, 7, '#c8b98a', true);
    r.rect(PLAYER_X - 10, PLAYER_FEET - 2, 84, 7, '#c8b98a', true);

    this.drawMon(r, this.foe, FOE_X, FOE_FEET, this.foeFlash, true);
    this.drawMon(r, this.active, PLAYER_X, PLAYER_FEET, this.playerFlash, false);

    // Panels sit opposite their own mon so neither covers the other.
    this.drawHpPanel(r, this.foe, 6, 8, false);
    this.drawHpPanel(r, this.active, VIEW_W - 136, 66, true);

    if (this.phase === 'menu') this.drawMoveGrid(r);
    this.textbox.render(r);
    this.menu.render(r);
  }

  /** Emerald's fight panel: four moves on the left, type and power on the right. */
  private drawMoveGrid(r: Renderer): void {
    const h = 48;
    const y = VIEW_H - h;
    const infoW = UI_ATLAS.fightInfo?.w ?? 78;
    const movesW = VIEW_W - infoW;

    if (!drawUiFrame(r, 'fightMoves', 0, y, movesW, h)) drawPlainFrame(r, 0, y, movesW, h);
    if (!drawUiFrame(r, 'fightInfo', movesW, y, infoW, h)) drawPlainFrame(r, movesW, y, infoW, h);

    const ids = this.active.spec.moves;
    ids.forEach((id, i) => {
      const mv = move(id);
      const col = i % 2;
      const row = i >> 1;
      const mx = 12 + col * 78;
      const my = y + 12 + row * 14;
      const label = mv.effect === 'heal' ? `${mv.name} x${healsLeft(this.active)}` : mv.name;
      // Emerald's fight box is pale, so its text is dark.
      drawShadowText(r, label.slice(0, 13), mx, my, '#3a3438', '#c8c0c8');
      if (i === this.moveIndex) drawShadowText(r, '>', mx - 7, my, '#e04038', '#f8c0b8');
    });

    // The Emerald panel has TYPE and PP baked into it. This game has neither
    // PP nor a type chart, so the interior is repainted in the panel's own
    // flat white and relabelled.
    // The baked labels reach closer to the border than the nine-slice inset,
    // so repaint a little wider than that.
    const pad = 5;
    r.rect(movesW + pad, y + pad, infoW - pad * 2, h - pad * 2, PANEL_WHITE, true);

    const chosen = move(ids[Math.min(this.moveIndex, ids.length - 1)]);
    drawShadowText(r, 'TYPE', movesW + 10, y + 12, '#3a3438', '#c8c0c8');
    drawShadowText(r, this.active.spec.type, movesW + 44, y + 12, '#3a3438', '#c8c0c8');
    drawShadowText(r, 'PWR', movesW + 10, y + 28, '#3a3438', '#c8c0c8');
    const power = chosen.power > 0 ? String(chosen.power) : '--';
    drawNumber(r, power, movesW + infoW - 12 - numberWidth(power), y + 28);
  }

  /** `feet` is the y of the ground line; sprites are bottom-aligned onto it. */
  private drawMon(r: Renderer, mon: MonState, x: number, feet: number, flash: number, isFoe: boolean): void {
    if (flash > 0 && Math.floor(flash / 3) % 2 === 0) return;

    const art = assets.get(`mon:${mon.spec.id}`);
    const spec = assets.spec(`mon:${mon.spec.id}`);

    // Footprint is the same whether art or a placeholder is drawn, so the
    // shield outline below fits either one.
    const w = spec?.frameW ?? (isFoe ? 40 : 44);
    const h = spec?.frameH ?? (isFoe ? 40 : 44);
    const top = feet - h;

    if (art && spec) {
      r.sprite(art, 0, 0, spec.frameW, spec.frameH, x, top, true);
    } else {
      r.rect(x, top, w, h, mon.spec.color, true);
      r.strokeRect(x, top, w, h, '#2a2438', true);
      r.textCentered(mon.spec.name.slice(0, 5), x + w / 2, feet - h / 2 - 4, '#ffffff', 8, true);
    }

    if (mon.shielded) {
      const pulse = Math.floor(this.ticks / 10) % 2 === 0 ? '#6fd8ff' : '#bdefff';
      r.strokeRect(x - 3, top - 3, w + 6, h + 6, pulse, true);
      r.strokeRect(x - 5, top - 5, w + 10, h + 10, pulse, true);
    }
  }

  /** Emerald databox: the panel art, its own HP gradient, and its digit font. */
  private drawHpPanel(r: Renderer, mon: MonState, x: number, y: number, showNumbers: boolean): void {
    const key = showNumbers ? 'databoxPlayer' : 'databoxFoe';
    const meta = UI_ATLAS[key];
    const art = assets.get(`ui:${key}`);
    const ratio = Math.max(0, Math.min(1, mon.hp / mon.spec.maxHp));

    if (!art || !meta?.hp) {
      // Fallback: the plain panel the game used before the Emerald art landed.
      const w = 100;
      const h = showNumbers ? 34 : 24;
      drawPlainFrame(r, x, y, w, h);
      r.text(mon.spec.name, x + 6, y + 5, '#20202c', 8, true);
      r.rect(x + 6, y + 16, w - 12, 4, '#4a4a5e', true);
      r.rect(x + 6, y + 16, Math.round((w - 12) * ratio), 4, hpColour(ratio), true);
      return;
    }

    r.sprite(art, 0, 0, meta.w, meta.h, x, y, true);

    const [hx, hy, hw, hh] = meta.hp;
    const fill = assets.get('ui:hpFill');
    const width = Math.round(hw * ratio);
    if (fill && width > 0) {
      // overlay_hp stacks green, yellow and red bars of hh rows each.
      const band = ratio > 0.5 ? 0 : ratio > 0.2 ? 1 : 2;
      r.sprite(fill, 0, band * hh, width, hh, x + hx, y + hy, true);
    } else if (width > 0) {
      r.rect(x + hx, y + hy, width, hh, hpColour(ratio), true);
    }

    drawShadowText(r, mon.spec.name, x + 10, y + 6, '#3a3438', '#d8d8c0');
    drawShadowText(r, mon.spec.type, x + meta.w - 28, y + 6, '#7a6a5a', '#d8d8c0');

    if (showNumbers) {
      const label = `${Math.max(0, mon.hp)}/${mon.spec.maxHp}`;
      drawNumber(r, label, x + meta.w - 12 - numberWidth(label), y + hy + 7);
    }
  }
}

/**
 * Matches the red band of the HP bar in hpColour, so the warning starts
 * exactly when the bar turns red.
 */
const LOW_HP_RATIO = 0.2;
/** 1.21s at 60fps -- the clip's own length, so the beep loops seamlessly. */
const LOW_HP_INTERVAL = 72;

/** The flat interior colour of the Emerald fight panels. */
const PANEL_WHITE = '#f8f8f8';

/** Emerald's own HP thresholds: green above half, yellow above a fifth. */
function hpColour(ratio: number): string {
  return ratio > 0.5 ? '#48c05a' : ratio > 0.2 ? '#e0c03a' : '#d84a3a';
}

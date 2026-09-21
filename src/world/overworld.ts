import { openRegistry } from '../app/registry';
import type { Telemetry } from '../app/telemetry';
import { BattleScene } from '../battle/battleScene';
import { EXIT_PROMPT, GATE_OPENS, SIGN_PLAQUE, SIGN_RULES } from '../content/dialogue';
import { NPCS } from '../content/npcs';
import { ScriptRunner, type Script } from '../content/script';
import { assets } from '../engine/assets';
import { audio } from '../engine/audio';
import { TILE, VIEW_H, VIEW_W } from '../engine/config';
import type { Input } from '../engine/input';
import { clamp, type Renderer } from '../engine/renderer';
import type { Scene, SceneStack } from '../engine/scenes';
import * as Boulders from '../puzzle/boulders';
import * as Gates from '../puzzle/gates';
import { isSolved as panelsSolved, press as pressPanel, SIZE as PANEL_SIZE } from '../puzzle/lightsOut';
import { save } from '../state/save';
import { hasFlag, setFlag, type GameState } from '../state/gameState';
import { Menu } from '../ui/menu';
import { TextBox } from '../ui/textbox';
import { DIRECTION_DELTA, facingToward, tileInFront, type Direction } from './direction';
import { gymMap, PANEL_ORIGIN, PANEL_SPACING } from './maps/gym';
import { roomAt, WARPS, type Warp } from './maps/rooms';
import { drawCharacter } from './characterSprite';
import { drawFacingPip, Npc } from './npc';
import { Player } from './player';
import { atlasCell, quadName, tileDef } from './tilemap';
import { boulderSockets, gatePositions } from './puzzleSetup';

/** Frames to darken, to sit black, and to come back. */
const FADE_FRAMES = 12;
const HOLD_FRAMES = 6;
/** Discrete opacity levels, so the fade steps like hardware rather than gliding. */
const FADE_STEPS = 8;

interface Transition {
  warp: Warp;
  phase: 'out' | 'hold' | 'in';
  frame: number;
}

export interface OverworldDeps {
  renderer: Renderer;
  state: GameState;
  telemetry: Telemetry;
  stack: SceneStack;
  overlay: HTMLElement;
  input: Input;
}

export class Overworld implements Scene {
  /** Exposed so the end-to-end test can drive and assert real movement. */
  readonly player: Player;
  private npcs = NPCS.map((def) => new Npc(def));
  private textbox = new TextBox();
  private menu = new Menu();
  private runner: ScriptRunner;
  private ticks = 0;
  /** Suppresses a second warp on the tile you just arrived on. */
  private justWarped = false;
  /** Doorway fade: null when the player has control. */
  private transition: Transition | null = null;

  private readonly sockets = boulderSockets();
  private readonly gateHubs = gatePositions();

  constructor(private deps: OverworldDeps) {
    const { state } = deps;
    this.player = new Player(state.playerX, state.playerY, state.facing);
    this.runner = new ScriptRunner({
      textbox: this.textbox,
      menu: this.menu,
      renderer: deps.renderer,
      state,
      startBattle: () => this.startBattle(),
      openRegistry: () => this.openRegistry(),
      // The nickname is taken in the professor's intro, never inside the gym.
      askName: () => this.runner.resume(),
      track: (event, data) => deps.telemetry.track(event, data),
    });
  }

  // ---------------------------------------------------------------- state

  private get boulderState(): Boulders.BoulderState {
    return { boulders: this.deps.state.boulders, sockets: this.sockets };
  }

  /** Gate hubs are fixed by the map; only their arm directions are saved. */
  private get gates(): Gates.Gate[] {
    return this.gateHubs.map((hub) => ({
      id: hub.id,
      x: hub.x,
      y: hub.y,
      arms: this.deps.state.gates.find((g) => g.id === hub.id)?.arms ?? [],
    }));
  }

  private commitGates(gates: Gates.Gate[]): void {
    this.deps.state.gates = gates.map((g) => ({ id: g.id, arms: g.arms }));
  }

  // ---------------------------------------------------------------- update

  onEnter(): void {
    audio.playMusic('gym');
  }

  update(input: Input): void {
    this.ticks++;

    if (this.transition) {
      this.advanceTransition();
      return;
    }

    if (this.runner.running) {
      this.runner.update(input);
      if (!this.runner.running) this.persist();
      return;
    }

    if (input.pressed('a')) {
      input.consume('a');
      if (this.interact()) return;
    }

    const before = { x: this.player.tileX, y: this.player.tileY };
    const stepped = this.player.update(input, (x, y) => this.tryEnter(x, y, before));
    if (stepped) this.onStep(stepped.x, stepped.y);
  }

  /**
   * Walkability, plus the side effects of walking into something: shoving a
   * crate, or spinning a gate. Called by the player controller before it
   * commits to a step, with `from` being the square it is leaving.
   */
  private tryEnter(x: number, y: number, from: { x: number; y: number }): boolean {
    const facing = directionBetween(from, { x, y });

    // A crate moves if there is room beyond it; you then take its square.
    if (Boulders.boulderAt(this.boulderState, x, y)) {
      if (!facing) return false;
      const moved = Boulders.push(this.boulderState, x, y, facing, (bx, by) => this.isOpenGround(bx, by));
      if (!moved) {
        audio.play('bump');
        return false;
      }
      audio.play('crate');
      this.deps.state.boulderPushes++;
      this.checkBoulders();
      return true;
    }

    // Walking into a gate arm turns the gate and lets you through.
    const gates = this.gates;
    if (Gates.gatesBlocking(gates, x, y)) {
      if (!facing) return false;
      if (Gates.hubAt(gates, x, y)) return false; // the hub itself never gives
      const result = Gates.pushArm(gates, x, y, facing, (gx, gy) => !this.isOpenGround(gx, gy));
      if (!result.advance) {
        audio.play('bump');
        return false;
      }
      audio.play('gate');
      this.commitGates(gates);
      this.deps.state.gateTurns++;
      return true;
    }

    return this.isWalkable(x, y);
  }

  /** Plain terrain test, ignoring entities. */
  private isOpenGround(x: number, y: number): boolean {
    if (gymMap.isSolid(x, y)) return false;
    return !this.npcs.some((n) => n.x === x && n.y === y);
  }

  private isWalkable(x: number, y: number): boolean {
    if (gymMap.at(x, y) === 'D') return true; // doors are walked onto, then warp
    if (!this.isOpenGround(x, y)) return false;
    if (Boulders.boulderAt(this.boulderState, x, y)) return false;
    return !Gates.gatesBlocking(this.gates, x, y);
  }

  private onStep(x: number, y: number): void {
    const char = gymMap.at(x, y);

    if (char === 'b') this.pressPanel(x, y);
    if (char === 'D') {
      this.tryWarp(x, y);
      return;
    }
    this.justWarped = false;

    // Reaching the far side of the gate room is the gate puzzle's win test:
    // the geometry is the lock, so there is nothing else to check.
    const room = roomAt(x, y);
    if (room?.id === 'gates' && y <= room.y + 2 && !hasFlag(this.deps.state, 'puzzle:gates')) {
      setFlag(this.deps.state, 'puzzle:gates');
      this.deps.telemetry.track('puzzle:gates', { turns: this.deps.state.gateTurns });
      audio.play('solved');
      this.runner.start(GATE_OPENS);
    }

    this.persist();
  }

  // ---------------------------------------------------------------- puzzles

  private pressPanel(x: number, y: number): void {
    const cell = panelCellAt(x, y);
    if (cell === null || hasFlag(this.deps.state, 'puzzle:panels')) return;

    const { state } = this.deps;
    state.panels = pressPanel(state.panels, cell);
    state.panelPresses++;
    audio.play('panel');
    if (panelsSolved(state.panels)) {
      setFlag(state, 'puzzle:panels');
      state.puzzleSolvedAtMs = Date.now() - state.startedAtMs;
      this.deps.telemetry.track('puzzle:panels', { presses: state.panelPresses });
      audio.play('solved');
      this.runner.start(GATE_OPENS);
    }
  }

  private checkBoulders(): void {
    const { state } = this.deps;
    if (hasFlag(state, 'puzzle:boulders')) return;
    if (!Boulders.isSolved(this.boulderState)) return;
    setFlag(state, 'puzzle:boulders');
    this.deps.telemetry.track('puzzle:boulders', { pushes: state.boulderPushes });
    audio.play('solved');
    this.runner.start(GATE_OPENS);
  }

  // ---------------------------------------------------------------- warps

  private warpAt(x: number, y: number): Warp | undefined {
    return WARPS.find((w) => w.x === x && w.y === y);
  }

  private tryWarp(x: number, y: number): void {
    if (this.justWarped) return;
    const warp = this.warpAt(x, y);
    if (!warp) return;

    if (warp.requires && !hasFlag(this.deps.state, warp.requires)) {
      // Bounce the player back off a locked door rather than trapping them on it.
      const back = DIRECTION_DELTA[opposite(warp.facing)];
      audio.play('bump');
      this.player.teleport(x + back.dx, y + back.dy, opposite(warp.facing));
      this.runner.start(lockedScript(warp));
      this.persist();
      return;
    }

    // Fade out, move, fade in. The teleport happens at the darkest frame so
    // the new room is never glimpsed before it is meant to be.
    this.justWarped = true;
    audio.play('door');
    this.transition = { warp, phase: 'out', frame: 0 };
  }

  private advanceTransition(): void {
    const t = this.transition;
    if (!t) return;

    t.frame++;
    if (t.phase === 'out' && t.frame >= FADE_FRAMES) {
      this.player.teleport(t.warp.toX, t.warp.toY, t.warp.facing);
      this.deps.telemetry.track('warp', { to: roomAt(t.warp.toX, t.warp.toY)?.id ?? 'void' });
      this.persist();
      t.phase = 'hold';
      t.frame = 0;
      return;
    }
    if (t.phase === 'hold' && t.frame >= HOLD_FRAMES) {
      t.phase = 'in';
      t.frame = 0;
      return;
    }
    if (t.phase === 'in' && t.frame >= FADE_FRAMES) {
      this.transition = null;
    }
  }

  /** 0 = clear, 1 = fully black. */
  private get fadeAmount(): number {
    const t = this.transition;
    if (!t) return 0;
    if (t.phase === 'out') return Math.min(1, t.frame / FADE_FRAMES);
    if (t.phase === 'hold') return 1;
    return Math.max(0, 1 - t.frame / FADE_FRAMES);
  }

  // ---------------------------------------------------------------- interact

  private interact(): boolean {
    const { x, y } = tileInFront(this.player.tileX, this.player.tileY, this.player.facing);

    const npc = this.npcs.find((n) => n.x === x && n.y === y);
    if (npc) {
      if (npc.def.turnsToFace !== false) {
        npc.facing = facingToward(npc.x, npc.y, this.player.tileX, this.player.tileY);
      }
      this.runner.start(npc.def.script);
      return true;
    }

    const script = this.scriptForTile(x, y);
    if (script) {
      this.runner.start(script);
      return true;
    }
    return false;
  }

  private scriptForTile(x: number, y: number): Script | null {
    const tile = gymMap.at(x, y);
    if (tile === 'S') return SIGN_PLAQUE;
    if (tile === 'C') return SIGN_RULES;
    if (tile === 'D') {
      const warp = this.warpAt(x, y);
      if (warp?.requires && !hasFlag(this.deps.state, warp.requires)) return lockedScript(warp);
      return null;
    }
    const room = roomAt(x, y);
    if (!room && this.player.tileY >= gymMap.height - 4) return EXIT_PROMPT;
    return null;
  }

  private startBattle(): void {
    this.deps.stack.push(
      new BattleScene({
        renderer: this.deps.renderer,
        state: this.deps.state,
        track: (event, data) => this.deps.telemetry.track(event, data),
        onEnd: () => {
          this.deps.stack.pop();
          this.persist();
          this.runner.resume();
        },
      }),
    );
  }

  private openRegistry(): void {
    openRegistry({
      overlay: this.deps.overlay,
      input: this.deps.input,
      state: this.deps.state,
      telemetry: this.deps.telemetry,
      onClose: (applied) => {
        this.deps.telemetry.track(applied ? 'registry:submitted' : 'registry:dismissed');
        this.persist();
        this.runner.resume();
      },
    });
  }

  private persist(): void {
    const { state } = this.deps;
    state.playerX = this.player.tileX;
    state.playerY = this.player.tileY;
    state.facing = this.player.facing;
    save(state);
  }

  // ---------------------------------------------------------------- render

  render(r: Renderer): void {
    this.focusCamera(r);
    r.clear('#15141f');
    this.renderTiles(r);

    // Depth sort so anything lower on the screen draws in front.
    const entities: Array<{ y: number; draw: () => void }> = [
      ...this.npcs.map((npc) => ({ y: npc.y * TILE, draw: () => npc.render(r) })),
      ...this.deps.state.boulders.map((b) => ({
        y: b.y * TILE,
        draw: () => this.drawTileArt(r, Boulders.isSocket(this.boulderState, b.x, b.y) ? 'socketFilled' : 'boulder', b.x, b.y),
      })),
      { y: this.player.pixelY, draw: () => this.renderPlayer(r) },
    ];
    entities.sort((a, b) => a.y - b.y);
    for (const entity of entities) entity.draw();

    this.renderGates(r);
    this.runner.render();

    const fade = this.fadeAmount;
    if (fade > 0) {
      // Quantised so the fade reads as stepped GBA dithering rather than a
      // smooth modern crossfade.
      const steps = Math.round(fade * FADE_STEPS) / FADE_STEPS;
      r.rect(0, 0, VIEW_W, VIEW_H, `rgba(0,0,0,${steps})`, true);
    }
  }

  /** Camera follows the player but never looks outside the current room. */
  private focusCamera(r: Renderer): void {
    const room = roomAt(this.player.tileX, this.player.tileY);
    const cx = this.player.pixelX + TILE / 2;
    const cy = this.player.pixelY + TILE / 2;

    if (!room) {
      r.centerOn(cx, cy, gymMap.pixelWidth, gymMap.pixelHeight);
      return;
    }

    const left = room.x * TILE;
    const top = room.y * TILE;
    const width = room.rows[0].length * TILE;
    const height = room.rows.length * TILE;

    // A room narrower than the screen is centred rather than clamped, so we
    // never show the void between rooms.
    r.camX = Math.round(
      width <= VIEW_W ? left + (width - VIEW_W) / 2 : clamp(cx - VIEW_W / 2, left, left + width - VIEW_W),
    );
    r.camY = Math.round(
      height <= VIEW_H ? top + (height - VIEW_H) / 2 : clamp(cy - VIEW_H / 2, top, top + height - VIEW_H),
    );
  }

  private renderTiles(r: Renderer): void {
    const startX = Math.max(0, Math.floor(r.camX / TILE));
    const startY = Math.max(0, Math.floor(r.camY / TILE));
    const endX = Math.min(gymMap.width, Math.ceil((r.camX + VIEW_W) / TILE) + 1);
    const endY = Math.min(gymMap.height, Math.ceil((r.camY + VIEW_H) / TILE) + 1);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const char = gymMap.at(x, y);
        const def = tileDef(char);

        let name = def.atlas === 'quad' ? quadName(x, y) : def.atlas;
        // A wall standing directly on floor gets the rip's skirting tile, so
        // room edges read as walls rather than flat blocks of colour.
        if (name === 'wall' && !gymMap.isSolid(x, y + 1)) name = 'wallBase';
        if (char === 'b') {
          const cell = panelCellAt(x, y);
          name = cell !== null && this.deps.state.panels[cell] ? 'buttonOn' : 'buttonOff';
        }
        if (char === 'o' && Boulders.boulderAt(this.boulderState, x, y)) continue; // crate covers it

        if (!this.drawTileArt(r, name, x, y)) {
          // Placeholder path, used until the atlas image loads.
          r.rect(x * TILE, y * TILE, TILE, TILE, def.color);
          if (def.capColor) r.rect(x * TILE, y * TILE, TILE, 5, def.capColor);
        }
      }
    }
  }

  /** Blits one named atlas tile. Returns false when the atlas is unavailable. */
  private drawTileArt(r: Renderer, name: string, x: number, y: number): boolean {
    const atlas = assets.get('tileset');
    const cell = atlasCell(name);
    if (!atlas || !cell) return false;
    r.sprite(atlas, cell.col * TILE, cell.row * TILE, TILE, TILE, x * TILE, y * TILE);
    return true;
  }

  private renderGates(r: Renderer): void {
    for (const gate of this.gates) {
      this.drawTileArt(r, 'gateHub', gate.x, gate.y);
      for (const arm of Gates.armTiles(gate)) {
        const horizontal = arm.dir === 'left' || arm.dir === 'right';
        this.drawTileArt(r, horizontal ? 'gateArmH' : 'gateArmV', arm.x, arm.y);
      }
    }
  }

  private renderPlayer(r: Renderer): void {
    const px = this.player.pixelX;
    const py = this.player.pixelY;
    if (drawCharacter(r, 'char:player', px, py, this.player.facing, this.player.walkFrame, this.player.isMoving)) {
      return;
    }
    const bob = this.player.walkFrame === 1 ? 1 : 0;
    r.rect(px + 3, py + 1 + bob, TILE - 6, TILE - 3, '#e8503f');
    r.strokeRect(px + 3, py + 1 + bob, TILE - 6, TILE - 3, '#2a2438');
    drawFacingPip(r, px, py + bob, this.player.facing);
  }

}

/** Direction from one adjacent tile to another, or null if they are not adjacent. */
function directionBetween(
  from: { x: number; y: number },
  to: { x: number; y: number },
): Direction | null {
  if (to.x === from.x && to.y === from.y - 1) return 'up';
  if (to.x === from.x && to.y === from.y + 1) return 'down';
  if (to.x === from.x - 1 && to.y === from.y) return 'left';
  if (to.x === from.x + 1 && to.y === from.y) return 'right';
  return null;
}

function opposite(dir: Direction): Direction {
  return dir === 'up' ? 'down' : dir === 'down' ? 'up' : dir === 'left' ? 'right' : 'left';
}

function lockedScript(warp: Warp): Script {
  return [{ say: warp.lockedMessage ?? 'It will not open yet.' }];
}

/** Maps a tile coordinate to a Lights Out cell index, or null if it is not a panel. */
export function panelCellAt(x: number, y: number): number | null {
  const dx = x - PANEL_ORIGIN.x;
  const dy = y - PANEL_ORIGIN.y;
  if (dx < 0 || dy < 0 || dx % PANEL_SPACING !== 0 || dy % PANEL_SPACING !== 0) return null;
  const col = dx / PANEL_SPACING;
  const row = dy / PANEL_SPACING;
  if (col >= PANEL_SIZE || row >= PANEL_SIZE) return null;
  return row * PANEL_SIZE + col;
}

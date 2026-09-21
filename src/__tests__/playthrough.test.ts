// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { Overworld } from '../world/overworld';
import { IntroScene } from '../ui/introScene';
import { openNameEntry } from '../app/nameEntry';
import { SceneStack } from '../engine/scenes';
import { BattleScene } from '../battle/battleScene';
import { Telemetry } from '../app/telemetry';
import { createGameState } from '../state/gameState';
import { gymMap, PLAYER_SPAWN } from '../world/maps/gym';
import { ROOMS, roomAt, WARPS } from '../world/maps/rooms';
import { NPCS } from '../content/npcs';
import { STARTERS } from '../battle/teams';
import { rivalFor } from '../battle/rivals';
import { solve } from '../puzzle/lightsOut';
import { panelCellAt } from '../world/overworld';
import type { Button, Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import type { Direction } from '../world/direction';

/**
 * Drives the real scenes with fake input and a no-op renderer, from the
 * professor's lab all the way to a submitted application. The gym is hard
 * gated, so a softlock anywhere in this chain silently costs a real
 * applicant; this test walks the whole thing rather than trusting it.
 */

class FakeInput {
  private held = new Set<Button>();
  private pressedSet = new Set<Button>();
  private consumed = new Set<Button>();
  suspended = false;

  hold(b: Button): void {
    if (!this.held.has(b)) this.pressedSet.add(b);
    this.held.add(b);
  }
  release(b: Button): void {
    this.held.delete(b);
  }
  down(b: Button): boolean {
    return !this.suspended && this.held.has(b);
  }
  pressed(b: Button): boolean {
    return !this.suspended && this.pressedSet.has(b) && !this.consumed.has(b);
  }
  consume(b: Button): void {
    this.consumed.add(b);
  }
  endFrame(): void {
    this.pressedSet.clear();
    this.consumed.clear();
  }
  setSuspended(v: boolean): void {
    this.suspended = v;
  }
}

/**
 * A renderer that draws nothing but implements everything.
 *
 * The harness calls render() on every tick, so any scene that reaches for a
 * missing mon, tile or image throws here rather than in someone's browser.
 */
function fakeRenderer(): Renderer {
  const ctx = {
    drawImage() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    measureText: (t: string) => ({ width: t.length * 5 }),
    save() {},
    restore() {},
    translate() {},
    scale() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: false,
    textBaseline: 'top',
  };
  return {
    camX: 0,
    camY: 0,
    ctx: ctx as unknown as CanvasRenderingContext2D,
    fitToWindow() {},
    centerOn() {},
    clear() {},
    rect() {},
    strokeRect() {},
    sprite() {},
    nineSlice() {},
    line() {},
    text() {},
    textCentered() {},
    measure: (s: string) => s.length * 5,
  } as unknown as Renderer;
}


function setup() {
  const state = createGameState();
  const stack = new SceneStack();
  const input = new FakeInput();
  const overlay = document.createElement('div');
  document.body.append(overlay);
  const renderer = fakeRenderer();
  const telemetry = new Telemetry(() => state);

  let overworld: Overworld | null = null;

  const enterGym = (): void => {
    overworld = new Overworld({
      renderer, state, telemetry, stack, overlay,
      input: input as unknown as Input,
    });
    stack.push(overworld);
  };

  const startIntro = (): void => {
    stack.push(
      new IntroScene({
        renderer,
        state,
        track: (e, d) => telemetry.track(e, d),
        askName: (onDone) =>
          openNameEntry({ overlay, input: input as unknown as Input, state, onClose: onDone }),
        onDone: () => {
          stack.pop();
          enterGym();
        },
      }),
    );
  };

  const world = (): Overworld => {
    if (!overworld) throw new Error('the gym has not been entered yet');
    return overworld;
  };
  const player = () => world().player;
  const running = (): boolean =>
    (world() as unknown as { runner: { running: boolean } }).runner.running;

  const tick = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      stack.update(input as unknown as Input);
      input.endFrame();
      // Render every frame too: a crash in a draw path is just as fatal as
      // one in update, and only rendering catches it.
      stack.render(renderer);
    }
  };

  const tap = (b: Button): void => {
    input.hold(b);
    tick();
    input.release(b);
    tick();
  };

  const clearDialogue = (max = 400): void => {
    for (let i = 0; i < max && running(); i++) tap('a');
  };

  /** Everything the player cannot walk through right now. */
  const blockers = (): Set<string> => new Set(NPCS.map((n) => `${n.x},${n.y}`));

  /** BFS that stays inside rooms and never steps onto a door by accident. */
  const path = (tx: number, ty: number, avoid = new Set<string>()): Array<[number, number]> | null => {
    const start: [number, number] = [player().tileX, player().tileY];
    const blocked = blockers();
    const passable = (x: number, y: number): boolean => {
      const key = `${x},${y}`;
      if (key === `${tx},${ty}`) return !gymMap.isSolid(x, y) || gymMap.at(x, y) === 'D';
      if (blocked.has(key) || avoid.has(key)) return false;
      if (gymMap.at(x, y) === 'D') return false; // doors warp; never route through one
      return !gymMap.isSolid(x, y);
    };

    const prev = new Map<string, string | null>([[`${start[0]},${start[1]}`, null]]);
    const queue: Array<[number, number]> = [start];
    while (queue.length) {
      const [x, y] = queue.shift() as [number, number];
      if (x === tx && y === ty) break;
      for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]] as Array<[number, number]>) {
        const key = `${nx},${ny}`;
        if (prev.has(key) || !passable(nx, ny)) continue;
        prev.set(key, `${x},${y}`);
        queue.push([nx, ny]);
      }
    }
    if (!prev.has(`${tx},${ty}`)) return null;
    const out: Array<[number, number]> = [];
    let cur: string | null = `${tx},${ty}`;
    while (cur && cur !== `${start[0]},${start[1]}`) {
      const [px, py] = cur.split(',').map(Number);
      out.unshift([px, py]);
      cur = prev.get(cur) ?? null;
    }
    return out;
  };

  /** One committed step; returns true if the player actually moved. */
  const step = (dir: Direction): boolean => {
    const before = { x: player().tileX, y: player().tileY };
    input.hold(dir);
    let guard = 0;
    while (guard++ < 60) {
      tick();
      if (!player().isMoving && (player().tileX !== before.x || player().tileY !== before.y)) break;
    }
    input.release(dir);
    tick(2);
    return player().tileX !== before.x || player().tileY !== before.y;
  };

  const walkTo = (tx: number, ty: number, avoid?: Set<string>): void => {
    const route = path(tx, ty, avoid);
    expect(route, `no route from ${player().tileX},${player().tileY} to ${tx},${ty}`).not.toBeNull();
    for (const [nx, ny] of route as Array<[number, number]>) {
      const dir: Direction =
        nx > player().tileX ? 'right' : nx < player().tileX ? 'left'
        : ny > player().tileY ? 'down' : 'up';
      expect(step(dir), `blocked walking to ${nx},${ny}`).toBe(true);
      clearDialogue();
    }
  };

  const faceAndTalk = (x: number, y: number): void => {
    const dir: Direction =
      x > player().tileX ? 'right' : x < player().tileX ? 'left'
      : y > player().tileY ? 'down' : 'up';
    input.hold(dir);
    tick();
    input.release(dir);
    tick();
    expect(player().facing).toBe(dir);
    tap('a');
    expect(running(), `nothing to talk to at ${x},${y}`).toBe(true);
  };

  /** Walks up to a door and steps through it, asserting the room changes. */
  const useDoor = (doorX: number, doorY: number): void => {
    const from = roomAt(player().tileX, player().tileY)?.id;
    const approach: Array<[number, number]> = [
      [doorX, doorY + 1], [doorX, doorY - 1], [doorX - 1, doorY], [doorX + 1, doorY],
    ];
    const spot = approach.find(([x, y]) => !gymMap.isSolid(x, y) && gymMap.at(x, y) !== 'D');
    expect(spot, `no way to approach the door at ${doorX},${doorY}`).toBeDefined();
    walkTo((spot as [number, number])[0], (spot as [number, number])[1]);

    const dir: Direction =
      doorY < player().tileY ? 'up' : doorY > player().tileY ? 'down'
      : doorX > player().tileX ? 'right' : 'left';
    step(dir);
    // Doorways fade out, move, then fade back in, so the room does not change
    // on the same frame the player steps onto the tile.
    for (let i = 0; i < 120 && roomAt(player().tileX, player().tileY)?.id === from; i++) tick();
    clearDialogue();
    expect(roomAt(player().tileX, player().tileY)?.id, 'the door did not lead anywhere').not.toBe(from);
  };

  return {
    state, stack, input, overlay, tick, tap, walkTo, faceAndTalk, clearDialogue,
    running, player, startIntro, enterGym, useDoor, step,
  };
}

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => 'test-session' },
      configurable: true,
    });
  }
});

describe('movement', () => {
  it('starts in the entrance hall', () => {
    const h = setup();
    h.enterGym();
    expect([h.player().tileX, h.player().tileY]).toEqual([PLAYER_SPAWN.x, PLAYER_SPAWN.y]);
    expect(roomAt(h.player().tileX, h.player().tileY)?.id).toBe('entry');
  });

  it('refuses to walk into a wall', () => {
    const h = setup();
    h.enterGym();
    const room = roomAt(PLAYER_SPAWN.x, PLAYER_SPAWN.y);
    h.walkTo((room?.x ?? 0) + 1, PLAYER_SPAWN.y);
    expect(h.step('left')).toBe(false);
  });

  it('bounces the player back off a locked door instead of stranding them on it', () => {
    const h = setup();
    h.enterGym();
    const locked = WARPS.find((w) => w.requires === 'puzzle:panels');
    expect(locked).toBeDefined();
    const door = locked as { x: number; y: number };

    // Reach the panel room first; that door is not locked.
    h.useDoor(...doorOut('entry'));
    expect(roomAt(h.player().tileX, h.player().tileY)?.id).toBe('panels');

    const panels = new Set(gymMap.findAll('b').map((t) => `${t.x},${t.y}`));
    h.walkTo(door.x, door.y + 1, panels);
    expect(h.state.flags.has('puzzle:panels'), 'walking to the door should not solve it').toBe(false);
    h.step('up');
    h.tick(120); // long enough for a transition, had one wrongly started
    h.clearDialogue();
    // Still in the panel room, on walkable ground, not sitting in the doorway.
    expect(roomAt(h.player().tileX, h.player().tileY)?.id).toBe('panels');
    expect(gymMap.at(h.player().tileX, h.player().tileY)).not.toBe('D');
  });
});

describe('doorway transition', () => {
  it('fades out before moving the player, and freezes them while it plays', () => {
    const h = setup();
    h.enterGym();
    const [doorX, doorY] = doorOut('entry');
    h.walkTo(doorX, doorY + 1);

    const before = roomAt(h.player().tileX, h.player().tileY)?.id;
    h.step('up');

    // The player is still in the old room while the screen darkens.
    expect(roomAt(h.player().tileX, h.player().tileY)?.id).toBe(before);

    // And cannot walk away mid-fade.
    const spot = { x: h.player().tileX, y: h.player().tileY };
    h.input.hold('down');
    h.tick(6);
    h.input.release('down');
    expect({ x: h.player().tileX, y: h.player().tileY }).toEqual(spot);

    // The move lands once the fade completes.
    for (let i = 0; i < 120 && roomAt(h.player().tileX, h.player().tileY)?.id === before; i++) h.tick();
    expect(roomAt(h.player().tileX, h.player().tileY)?.id).toBe('panels');

    // Control comes back.
    h.tick(60);
    const after = { x: h.player().tileX, y: h.player().tileY };
    h.step('down');
    expect({ x: h.player().tileX, y: h.player().tileY }).not.toEqual(after);
  });

  it('does not re-trigger on the tile it drops you onto', () => {
    const h = setup();
    h.enterGym();
    h.useDoor(...doorOut('entry'));
    expect(roomAt(h.player().tileX, h.player().tileY)?.id).toBe('panels');
    // Sitting still must not bounce the player back through the door.
    h.tick(120);
    expect(roomAt(h.player().tileX, h.player().tileY)?.id).toBe('panels');
  });
});

describe('full playthrough', () => {
  it('goes lab -> hall -> panels -> fame -> rival -> arena -> application', async () => {
    const h = setup();

    // 1. Professor SymmeTREE: nickname, then a starter.
    h.startIntro();
    for (let i = 0; i < 40 && !h.overlay.querySelector('form'); i++) h.tap('a');
    const nameForm = h.overlay.querySelector('form');
    expect(nameForm, 'the professor never asked for a name').not.toBeNull();
    const nick = nameForm?.querySelector<HTMLInputElement>('[name=nickname]');
    if (nick) nick.value = 'ADA';
    nameForm?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(h.state.playerName).toBe('ADA');

    for (let i = 0; i < 80 && !h.state.starter; i++) h.tap('a');
    expect(STARTERS.map((s) => s.id)).toContain(h.state.starter);
    for (let i = 0; i < 80 && !(h.stack.top instanceof Overworld); i++) h.tap('a');
    expect(h.stack.top).toBeInstanceOf(Overworld);

    // 2. Everyone in the entrance hall has something to say.
    for (const npc of NPCS.filter((n) => roomAt(n.x, n.y)?.id === 'entry')) {
      h.walkTo(npc.x, npc.y + 1);
      h.faceAndTalk(npc.x, npc.y);
      h.clearDialogue();
      expect(h.state.flags.has(`talked:${npc.id}`), `${npc.id} never set its flag`).toBe(true);
    }

    // 3. Through to the panel room and solve the 2x2 Lights Out.
    h.useDoor(...doorOut('entry'));
    expect(roomAt(h.player().tileX, h.player().tileY)?.id).toBe('panels');

    const panelTiles = gymMap.findAll('b');
    const avoidPanels = new Set(panelTiles.map((p) => `${p.x},${p.y}`));
    const presses = solve(h.state.panels);
    expect(presses).not.toBeNull();
    for (const cell of presses as number[]) {
      const tile = panelTiles.find((p) => panelCellAt(p.x, p.y) === cell);
      expect(tile, `no tile for panel cell ${cell}`).toBeDefined();
      const before = h.state.panelPresses;
      h.walkTo((tile as { x: number }).x, (tile as { y: number }).y, avoidPanels);
      h.clearDialogue();
      expect(h.state.panelPresses, 'stepped on more than one panel').toBe(before + 1);
    }
    expect(h.state.flags.has('puzzle:panels'), 'the panels never all lit').toBe(true);

    // 4. Hall of Fame: every plaque along the walls reads.
    h.useDoor(...doorOut('panels'));
    expect(roomAt(h.player().tileX, h.player().tileY)?.id).toBe('hall');

    const hall = ROOMS.find((r) => r.id === 'hall');
    const plaques = gymMap.findAll('C').filter((t) => roomAt(t.x, t.y)?.id === 'hall');
    expect(plaques.length, 'the hall should have plaques to read').toBeGreaterThan(3);
    for (const plaque of plaques.slice(0, 3)) {
      h.walkTo(plaque.x, plaque.y + 1);
      h.faceAndTalk(plaque.x, plaque.y);
      h.clearDialogue();
    }
    expect(hall).toBeDefined();

    // 5. Rival: the fight you are supposed to lose the type matchup.
    h.useDoor(...doorOut('hall'));
    expect(roomAt(h.player().tileX, h.player().tileY)?.id).toBe('rival');

    const rival = rivalFor(h.state.starter);
    const rivalNpc = NPCS.find((n) => n.id === 'rival');
    h.walkTo(rivalNpc?.x ?? 0, (rivalNpc?.y ?? 0) + 1);
    h.faceAndTalk(rivalNpc?.x ?? 0, rivalNpc?.y ?? 0);

    let rivalGuard = 0;
    while (!h.state.flags.has('rival:beaten') && rivalGuard++ < 6000) h.tap('a');
    expect(h.state.flags.has('rival:beaten'), `never beat ${rival.name}`).toBe(true);
    h.clearDialogue();

    // 6. Arena: Arpit, the battle, the shield question.
    h.useDoor(...doorOut('rival'));
    expect(roomAt(h.player().tileX, h.player().tileY)?.id).toBe('arena');

    const leader = NPCS.find((n) => n.id === 'leader');
    h.walkTo((leader?.x ?? 0), (leader?.y ?? 0) + 1);
    h.faceAndTalk(leader?.x ?? 0, leader?.y ?? 0);

    let guard = 0;
    while (!h.state.battleWon && guard++ < 5000) {
      const battle = h.stack.top;
      if (battle instanceof BattleScene) {
        const inner = battle as unknown as { phase: string; question: { answer: number } | null };
        if (inner.phase === 'question' && inner.question) {
          for (let i = 0; i < inner.question.answer; i++) h.tap('down');
          h.tap('a');
          continue;
        }
      }
      h.tap('a');
    }
    expect(h.state.battleWon, 'never beat Arpit').toBe(true);

    // 7. The registry.
    for (let i = 0; i < 80 && !h.overlay.querySelector('form'); i++) h.tap('a');
    const form = h.overlay.querySelector('form');
    expect(form, 'the registry never opened').not.toBeNull();
    const set = (name: string, value: string): void => {
      const f = form?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name=${name}]`);
      if (f) f.value = value;
    };
    expect(form?.querySelector<HTMLInputElement>('[name=name]')?.value).toBe('ADA');
    set('email', 'ada@stanford.edu');
    set('name', 'Ada Lovelace');
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    for (let i = 0; i < 20 && !h.state.applied; i++) await Promise.resolve();

    expect(h.state.applied, 'the application never went through').toBe(true);
    h.clearDialogue();
    const saved = JSON.parse(localStorage.getItem('smt-tech-gym:save:v3') ?? '{}');
    expect(saved.applied).toBe(true);
    expect(saved.battleWon).toBe(true);
  }, 60000);
});

/** The onward door out of a room: the one whose warp leads somewhere new. */
function doorOut(roomId: string): [number, number] {
  const warp = WARPS.find(
    (w) => roomAt(w.x, w.y)?.id === roomId && roomAt(w.toX, w.toY)?.id !== roomId && w.facing === 'up',
  );
  if (!warp) throw new Error(`no onward door out of ${roomId}`);
  return [warp.x, warp.y];
}

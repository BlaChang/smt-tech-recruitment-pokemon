// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { ARPIT, BattleScene, type Opponent } from '../battle/battleScene';
import { RIVALS, rivalFor, rivalTeam } from '../battle/rivals';
import { UI_KEYS } from '../content/assetManifest';
import { assets } from '../engine/assets';
import { createGameState } from '../state/gameState';
import type { Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';

/**
 * Trainers appear on the field before sending anything out, so the fight
 * opens on a person rather than on a creature nobody has been introduced to.
 *
 * Every assertion here needs the portrait to actually exist: with no art the
 * scene deliberately skips the whole sequence, which is also why the rest of
 * the suite never exercises it.
 */
const store = assets as unknown as { images: Map<string, unknown> };
const stubbed: string[] = [];

function givePortrait(slot: string, w = 52, h = 57): void {
  store.images.set(`ui:${slot}`, { width: w, height: h });
  stubbed.push(`ui:${slot}`);
}

afterEach(() => {
  for (const key of stubbed) store.images.delete(key);
  stubbed.length = 0;
});

/** Drives a battle from its first frame, recording every line it shows. */
function open(opponent?: Opponent) {
  const shown: string[] = [];
  const drawn: unknown[] = [];
  const renderer = {
    measure: (t: string) => t.length * 5,
    clear: () => {},
    rect: () => {},
    strokeRect: () => {},
    text: () => {},
    textCentered: () => {},
    sprite: (image: unknown) => drawn.push(image),
    ctx: { drawImage: () => {} },
  } as unknown as Renderer;

  const scene = new BattleScene({
    renderer,
    state: { ...createGameState(), starter: 'francis', playerName: 'ADA' },
    opponent,
    track: () => {},
    onEnd: () => {},
  });

  const inner = scene as unknown as {
    queue(...steps: Array<string | (() => void) | { wait: number }>): void;
    trainerExit: number;
    phase: string;
  };
  const original = inner.queue.bind(inner);
  inner.queue = (...steps) => {
    for (const step of steps) if (typeof step === 'string' && step) shown.push(step);
    original(...steps);
  };

  scene.onEnter();
  const input = { pressed: () => true, held: () => false, consume: () => {} } as unknown as Input;
  return {
    inner,
    shown,
    drawn,
    render: () => { drawn.length = 0; scene.render(renderer); return drawn; },
    tick: (n = 1) => { for (let i = 0; i < n; i++) scene.update(input); },
  };
}

describe('the trainer walks on first', () => {
  it('announces the trainer before their first mon', () => {
    givePortrait('trainerArpit');
    const { shown } = open(ARPIT);
    expect(shown[0]).toBe('Gym Leader ARPIT would like to battle!');
    expect(shown[1]).toContain('sent out');
  });

  it('holds the field until they have walked off', () => {
    givePortrait('trainerArpit');
    const { inner, render, tick } = open(ARPIT);

    // Standing there: the portrait is on screen.
    expect(inner.trainerExit).toBeLessThan(1);
    const portrait = store.images.get('ui:trainerArpit');
    expect(render()).toContain(portrait);

    // And gone by the time the fight starts.
    tick(400);
    expect(inner.trainerExit, 'the trainer never left').toBe(1);
    expect(render(), 'the trainer is still standing there').not.toContain(portrait);
  });

  it('hands over to a fight that can be played to the end', () => {
    // The walk-off is a timed pause in the step queue. Get that wrong and
    // the scene sits on a frozen portrait forever, with the gym hard-gated
    // behind it.
    givePortrait('trainerArpit');
    const { inner, tick } = open(ARPIT);
    let frames = 0;
    while (inner.phase !== 'done' && frames++ < 4000) tick();
    expect(inner.phase, 'the intro stranded the fight').toBe('done');
    expect(inner.trainerExit).toBe(1);
  });

  it('skips the whole sequence when there is no portrait', () => {
    // Art is optional everywhere else in this game; it has to be here too.
    const { shown, inner } = open({ ...ARPIT, portrait: 'trainerNobody' });
    expect(inner.trainerExit, 'nobody to wait for').toBe(1);
    expect(shown[0]).toContain('sent out');
  });
});

describe('every opponent has a face', () => {
  it('gives Arpit and all three rivals a portrait that is actually loaded', () => {
    const slots = [ARPIT.portrait, ...Object.values(RIVALS).map((r) => r.portrait)];
    for (const slot of slots) {
      expect(slot, 'an opponent has no portrait').toBeTruthy();
      expect(
        (UI_KEYS as readonly string[]).includes(slot as string),
        `${slot} is never fetched: add it to UI_KEYS`,
      ).toBe(true);
    }
  });

  it('matches each rival to their own face, not a shared one', () => {
    const seen = Object.values(RIVALS).map((r) => r.portrait);
    expect(new Set(seen).size, 'two rivals share a portrait').toBe(seen.length);
    for (const starter of ['francis', 'goose', 'blobheart']) {
      const rival = rivalFor(starter);
      expect(rival.portrait).toBe(`trainer${rival.name[0]}${rival.name.slice(1).toLowerCase()}`);
      expect(rivalTeam(rival)).toHaveLength(1);
    }
  });
});

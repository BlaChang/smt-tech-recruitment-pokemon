import { describe, expect, it } from 'vitest';
import { ScriptRunner, type Script, type ScriptContext } from '../content/script';
import { createGameState } from '../state/gameState';
import type { Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';

/**
 * The runner only ever calls show/update/hide on the text box and menu, so
 * fakes that resolve immediately let us drive a whole script in a few ticks.
 */
function harness(choose = 0) {
  const shown: string[] = [];
  const tracked: string[] = [];
  let battles = 0;
  let registries = 0;
  let nameAsks = 0;

  const textbox = {
    visible: false,
    show(text: string) {
      shown.push(text);
      this.visible = true;
    },
    update() {
      this.visible = false;
      return true; // dismissed on the first frame
    },
    hide() {
      this.visible = false;
    },
    render() {},
  };

  const menu = {
    visible: false,
    open() {
      this.visible = true;
    },
    update() {
      this.visible = false;
      return choose;
    },
    close() {
      this.visible = false;
    },
    render() {},
  };

  const ctx: ScriptContext = {
    textbox: textbox as unknown as ScriptContext['textbox'],
    menu: menu as unknown as ScriptContext['menu'],
    renderer: {} as Renderer,
    state: createGameState(),
    startBattle: () => {
      battles++;
    },
    openRegistry: () => {
      registries++;
    },
    startRivalBattle: () => {
      battles++;
    },
    askName: () => {
      nameAsks++;
    },
    track: (event) => {
      tracked.push(event);
    },
  };

  const runner = new ScriptRunner(ctx);
  const input = {} as Input;

  /** Pumps until the script finishes or we exceed a sane frame budget. */
  const run = (script: Script, maxFrames = 200): void => {
    runner.start(script);
    for (let i = 0; i < maxFrames && runner.running; i++) runner.update(input);
  };

  return {
    runner,
    ctx,
    run,
    shown,
    tracked,
    input,
    battles: () => battles,
    registries: () => registries,
    nameAsks: () => nameAsks,
  };
}

describe('script runner', () => {
  it('shows lines in order and finishes', () => {
    const h = harness();
    h.run([{ say: 'one' }, { say: 'two' }, { say: 'three' }]);
    expect(h.shown).toEqual(['one', 'two', 'three']);
    expect(h.runner.running).toBe(false);
  });

  it('sets flags and branches on them', () => {
    const h = harness();
    h.run([
      { setFlag: 'talked:greeter' },
      { ifFlag: 'talked:greeter', then: [{ say: 'yes' }], otherwise: [{ say: 'no' }] },
      { ifFlag: 'missing', then: [{ say: 'bad' }], otherwise: [{ say: 'fallback' }] },
    ]);
    expect(h.ctx.state.flags.has('talked:greeter')).toBe(true);
    expect(h.shown).toEqual(['yes', 'fallback']);
  });

  it('runs the branch matching the chosen option, then resumes the parent script', () => {
    const h = harness(1);
    h.run([
      { choice: ['a', 'b'], branch: [[{ say: 'took a' }], [{ say: 'took b' }]] },
      { say: 'after' },
    ]);
    expect(h.shown).toEqual(['took b', 'after']);
  });

  it('handles nested scripts several levels deep', () => {
    const h = harness();
    h.run([
      {
        ifState: () => true,
        then: [
          { say: 'outer' },
          { ifState: () => true, then: [{ say: 'inner' }, { ifState: () => true, then: [{ say: 'deepest' }] }] },
        ],
      },
      { say: 'last' },
    ]);
    expect(h.shown).toEqual(['outer', 'inner', 'deepest', 'last']);
  });

  it('suspends on battle until the host resumes it', () => {
    const h = harness();
    h.runner.start([{ say: 'before' }, { battle: true }, { say: 'after' }]);
    for (let i = 0; i < 10; i++) h.runner.update(h.input);
    expect(h.battles()).toBe(1);
    expect(h.shown).toEqual(['before']);
    expect(h.runner.running).toBe(true);

    h.runner.resume();
    for (let i = 0; i < 10 && h.runner.running; i++) h.runner.update(h.input);
    expect(h.shown).toEqual(['before', 'after']);
  });

  it('suspends on registry the same way', () => {
    const h = harness();
    h.runner.start([{ registry: true }, { say: 'signed' }]);
    for (let i = 0; i < 5; i++) h.runner.update(h.input);
    expect(h.registries()).toBe(1);
    h.runner.resume();
    for (let i = 0; i < 5 && h.runner.running; i++) h.runner.update(h.input);
    expect(h.shown).toEqual(['signed']);
  });

  it('suspends on askName until the player confirms a nickname', () => {
    const h = harness();
    h.runner.start([{ askName: true }, { say: 'Right! So your name is {name}!' }]);
    for (let i = 0; i < 5; i++) h.runner.update(h.input);
    expect(h.nameAsks()).toBe(1);
    expect(h.shown).toEqual([]);

    h.ctx.state.playerName = 'ADA';
    h.runner.resume();
    for (let i = 0; i < 5 && h.runner.running; i++) h.runner.update(h.input);
    expect(h.shown).toEqual(['Right! So your name is ADA!']);
  });

  it('falls back to CHALLENGER when no nickname was given', () => {
    const h = harness();
    h.run([{ say: 'Go on, {name}.' }]);
    expect(h.shown).toEqual(['Go on, CHALLENGER.']);
  });

  it('records tracked events and runs side effects', () => {
    const h = harness();
    h.run([{ track: 'puzzle:solved' }, { run: (ctx) => { ctx.state.starter = 'francis'; } }]);
    expect(h.tracked).toEqual(['puzzle:solved']);
    expect(h.ctx.state.starter).toBe('francis');
  });

  it('stop() clears everything mid-script', () => {
    const h = harness();
    h.runner.start([{ say: 'one' }, { say: 'two' }]);
    h.runner.update(h.input);
    h.runner.stop();
    expect(h.runner.running).toBe(false);
  });
});

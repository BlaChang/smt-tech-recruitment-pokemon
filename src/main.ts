import { applyDevShortcut } from './app/devShortcuts';
import { BattleScene } from './battle/battleScene';
import { openRegistry } from './app/registry';
import { openNameEntry } from './app/nameEntry';
import { IntroScene } from './ui/introScene';
import { assets } from './engine/assets';
import { audio, SOUND_NAMES } from './engine/audio';
import { MANIFEST } from './content/assetManifest';
import { Telemetry } from './app/telemetry';
import { Input } from './engine/input';
import { startLoop } from './engine/loop';
import { Renderer } from './engine/renderer';
import { SceneStack } from './engine/scenes';
import { createGameState, type GameState } from './state/gameState';
import { clearSave, load, save } from './state/save';
import { TitleScene } from './ui/titleScene';
import { Overworld } from './world/overworld';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
const overlay = document.querySelector<HTMLDivElement>('#overlay');
if (!canvas || !overlay) throw new Error('Missing #screen or #overlay in the document');

const HINT_TEXT =
  'Arrow keys / WASD to move \u00b7 Z or Enter to interact \u00b7 X to cancel \u00b7 M for sound';

const renderer = new Renderer(canvas);
const input = new Input();
const stack = new SceneStack();

let state: GameState = load() ?? createGameState();
const telemetry = new Telemetry(() => state);

input.attach();
renderer.fitToWindow();
window.addEventListener('resize', () => renderer.fitToWindow());
telemetry.attachAbandonBeacon();

const startOverworld = (): void => {
  stack.push(new Overworld({ renderer, state, telemetry, stack, overlay, input }));
};

/** Professor SymmeTREE's lab, then the gym. */
const startIntro = (): void => {
  stack.push(
    new IntroScene({
      renderer,
      state,
      track: (event, data) => telemetry.track(event, data),
      askName: (onDone) => openNameEntry({ overlay, input, state, onClose: onDone }),
      onDone: () => {
        save(state);
        stack.pop();
        startOverworld();
      },
    }),
  );
};

const devStage = applyDevShortcut(state);
if (devStage === 'intro') {
  // The lab is a scene of its own, not a place in the gym.
  startIntro();
} else if (devStage) {
  startOverworld();
  // Two stages are not reachable by warping the player: jump straight in.
  if (devStage === 'battle') {
    stack.push(
      new BattleScene({
        renderer,
        state,
        track: (event, data) => telemetry.track(event, data),
        // Mirrors the real leader fight: the win is what unlocks the registry.
        onEnd: (won) => {
          if (won) state.battleWon = true;
          stack.pop();
        },
      }),
    );
  }
  if (devStage === 'registry') {
    openRegistry({ overlay, input, state, telemetry, onClose: () => {} });
  }
} else {
  stack.push(
    new TitleScene({
      hasSave: load() !== null,
      onStart: (continueSave) => {
        if (!continueSave) {
          clearSave();
          state = createGameState();
        }
        // Restart the clock on resume so a tab left open overnight does not
        // report a twelve-hour playthrough.
        state.startedAtMs = Date.now();
        save(state);
        telemetry.track(continueSave ? 'session:resumed' : 'session:started');
        stack.pop();
        // A resumed save already met the professor and picked a partner.
        if (continueSave && state.starter) startOverworld();
        else startIntro();
      },
    }),
  );
}

// Art and audio are both optional: loading always resolves, and anything
// absent degrades to a placeholder or to silence.
await Promise.all([assets.load(MANIFEST), audio.load(SOUND_NAMES)]);
// Scenes request their own track; this is just the opening one.
audio.playMusic('menu');

// Browsers keep audio suspended until the user interacts, so the music
// starts on the first real keypress rather than on load.
window.addEventListener('keydown', () => audio.unlock(), { once: true });
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

// M mutes. Handled here rather than in Input because it is not a game button.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyM' || e.metaKey || e.ctrlKey) return;
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
  const muted = audio.toggleMute();
  const hint = document.querySelector('#hint');
  if (hint) hint.textContent = muted ? 'Sound off — press M to unmute' : HINT_TEXT;
});

startLoop(
  () => {
    stack.update(input);
    input.endFrame();
  },
  () => stack.render(renderer),
);

// Keyboard-only by design; warn rather than render an unplayable canvas.
if (window.matchMedia('(pointer: coarse)').matches) {
  const warning = document.querySelector<HTMLDivElement>('#touch-warning');
  warning?.classList.add('show');
  document
    .querySelector('#touch-continue')
    ?.addEventListener('click', () => warning?.classList.remove('show'));
}

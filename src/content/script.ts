import type { Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import type { Menu } from '../ui/menu';
import type { TextBox } from '../ui/textbox';
import { hasFlag, setFlag, type GameState } from '../state/gameState';

export type Script = ScriptCommand[];

export type ScriptCommand =
  /** Show a line of dialogue. `as` labels the speaker in a name plate. */
  | { say: string; as?: string }
  /** Branch on a player choice; `branch[i]` runs for `choice[i]`. */
  | { choice: string[]; branch: Script[] }
  | { setFlag: string }
  /** Run `then` if the flag is set, otherwise `otherwise`. */
  | { ifFlag: string; then: Script; otherwise?: Script }
  /** Same, but keyed off arbitrary state (battle won, puzzle solved, ...). */
  | { ifState: (state: GameState) => boolean; then: Script; otherwise?: Script }
  /** Hand control to the battle scene; the script resumes when it ends. */
  | { battle: true }
  /** Hand control to the DOM application form; the script resumes on submit. */
  | { registry: true }
  /** Ask the player to type a nickname; the script resumes once they confirm. */
  | { askName: true }
  /** Record a telemetry event. */
  | { track: string }
  /** Escape hatch for one-off side effects (setting starter, opening the gate). */
  | { run: (ctx: ScriptContext) => void };

export interface ScriptContext {
  textbox: TextBox;
  menu: Menu;
  renderer: Renderer;
  state: GameState;
  startBattle(): void;
  openRegistry(): void;
  askName(): void;
  track(event: string, data?: Record<string, unknown>): void;
}

type Frame = { cmds: Script; index: number };

/** Substitutes the player's chosen nickname into dialogue. */
export function format(text: string, playerName: string): string {
  return text.replace(/\{name\}/g, playerName || 'CHALLENGER');
}

/**
 * Walks a script one blocking command at a time. Non-blocking commands are
 * drained within a single update so `[{setFlag}, {say}]` shows text immediately.
 */
export class ScriptRunner {
  private stack: Frame[] = [];
  private mode: 'idle' | 'text' | 'choice' | 'suspended' = 'idle';
  private branches: Script[] = [];

  constructor(private ctx: ScriptContext) {}

  get running(): boolean {
    return this.stack.length > 0 || this.mode !== 'idle';
  }

  start(script: Script): void {
    this.stack = [{ cmds: script, index: 0 }];
    this.mode = 'idle';
  }

  stop(): void {
    this.stack = [];
    this.mode = 'idle';
    this.ctx.textbox.hide();
    this.ctx.menu.close();
  }

  /** Called by the host scene once a `battle` or `registry` command resolves. */
  resume(): void {
    if (this.mode === 'suspended') this.mode = 'idle';
  }

  update(input: Input): void {
    if (this.mode === 'text') {
      if (!this.ctx.textbox.update(input)) return;
      this.mode = 'idle';
    } else if (this.mode === 'choice') {
      const picked = this.ctx.menu.update(input);
      if (picked === null) return;
      this.mode = 'idle';
      this.ctx.textbox.hide();
      const branch = this.branches[picked];
      this.branches = [];
      if (branch?.length) this.stack.push({ cmds: branch, index: 0 });
    } else if (this.mode === 'suspended') {
      return;
    }

    // Drain non-blocking commands until something needs input or the script ends.
    while (this.mode === 'idle' && this.stack.length > 0) {
      const frame = this.stack[this.stack.length - 1];
      if (frame.index >= frame.cmds.length) {
        this.stack.pop();
        continue;
      }
      this.exec(frame.cmds[frame.index++]);
    }
  }

  private exec(cmd: ScriptCommand): void {
    const { ctx } = this;

    if ('say' in cmd) {
      ctx.textbox.show(format(cmd.say, ctx.state.playerName), ctx.renderer, cmd.as);
      this.mode = 'text';
      return;
    }
    if ('choice' in cmd) {
      this.branches = cmd.branch;
      ctx.menu.open(cmd.choice);
      this.mode = 'choice';
      return;
    }
    if ('setFlag' in cmd) {
      setFlag(ctx.state, cmd.setFlag);
      return;
    }
    if ('ifFlag' in cmd) {
      const taken = hasFlag(ctx.state, cmd.ifFlag) ? cmd.then : cmd.otherwise;
      if (taken?.length) this.stack.push({ cmds: taken, index: 0 });
      return;
    }
    if ('ifState' in cmd) {
      const taken = cmd.ifState(ctx.state) ? cmd.then : cmd.otherwise;
      if (taken?.length) this.stack.push({ cmds: taken, index: 0 });
      return;
    }
    if ('battle' in cmd) {
      this.mode = 'suspended';
      ctx.textbox.hide();
      ctx.startBattle();
      return;
    }
    if ('registry' in cmd) {
      this.mode = 'suspended';
      ctx.textbox.hide();
      ctx.openRegistry();
      return;
    }
    if ('askName' in cmd) {
      this.mode = 'suspended';
      ctx.textbox.hide();
      ctx.askName();
      return;
    }
    if ('track' in cmd) {
      ctx.track(cmd.track);
      return;
    }
    cmd.run(ctx);
  }

  render(): void {
    this.ctx.textbox.render(this.ctx.renderer);
    this.ctx.menu.render(this.ctx.renderer);
  }
}

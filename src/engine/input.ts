export type Button = 'up' | 'down' | 'left' | 'right' | 'a' | 'b';

/** True for anything the user can type into. */
function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
}

const KEY_MAP: Record<string, Button> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', Enter: 'a', Space: 'a',
  KeyX: 'b', Escape: 'b', Backspace: 'b',
};

/**
 * Held state plus per-frame edge detection. `endFrame()` must be called once at
 * the tail of every logical update or `pressed()` will report stale edges.
 */
export class Input {
  private held = new Set<Button>();
  private pressedThisFrame = new Set<Button>();
  private consumed = new Set<Button>();
  /** Set while a DOM overlay (the registry form) owns the keyboard. */
  private suspended = false;

  attach(target: Window = window): void {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    // Held keys survive a tab switch and cause phantom walking on return.
    target.addEventListener('blur', this.releaseAll);
  }

  detach(target: Window = window): void {
    target.removeEventListener('keydown', this.onKeyDown);
    target.removeEventListener('keyup', this.onKeyUp);
    target.removeEventListener('blur', this.releaseAll);
  }

  setSuspended(value: boolean): void {
    this.suspended = value;
    if (value) this.releaseAll();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const button = KEY_MAP[e.code];
    if (!button || this.ignores(e)) return;
    e.preventDefault();
    if (!this.held.has(button)) this.pressedThisFrame.add(button);
    this.held.add(button);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const button = KEY_MAP[e.code];
    if (!button || this.ignores(e)) return;
    e.preventDefault();
    this.held.delete(button);
  };

  /**
   * Whether this key belongs to something other than the game.
   *
   * Critically, this is checked *before* preventDefault. Most of the game's
   * keys are ordinary characters -- W A S D Z X and space -- and Backspace is
   * mapped to cancel, so swallowing them while a form is focused makes the
   * field impossible to type in. Suspension alone is not enough either: the
   * target check means an overlay that forgets to suspend still behaves.
   */
  private ignores(e: KeyboardEvent): boolean {
    return this.suspended || isEditable(e.target);
  }

  private releaseAll = (): void => {
    this.held.clear();
    this.pressedThisFrame.clear();
  };

  down(button: Button): boolean {
    return this.held.has(button);
  }

  pressed(button: Button): boolean {
    return this.pressedThisFrame.has(button) && !this.consumed.has(button);
  }

  /** Claim a press so a scene underneath this frame's handler does not also see it. */
  consume(button: Button): void {
    this.consumed.add(button);
  }

  endFrame(): void {
    this.pressedThisFrame.clear();
    this.consumed.clear();
  }
}

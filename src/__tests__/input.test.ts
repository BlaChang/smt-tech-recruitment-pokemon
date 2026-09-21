// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Input } from '../engine/input';

/**
 * Most of the game's controls are ordinary typing keys -- W A S D Z X, space,
 * Enter, Backspace and the arrows. If the game calls preventDefault on those
 * while a form is focused, the field silently refuses input, which is exactly
 * what happened to the nickname prompt and the application form.
 */

let input: Input;

beforeEach(() => {
  document.body.replaceChildren();
  input = new Input();
  input.attach();
});

afterEach(() => {
  input.detach();
});

function press(code: string, target: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function release(code: string, target: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

/** Every mapped key that is also a character someone might type. */
const TYPING_KEYS = [
  'KeyA', 'KeyW', 'KeyS', 'KeyD', 'KeyZ', 'KeyX',
  'Space', 'Backspace', 'Enter',
  'ArrowLeft', 'ArrowRight',
];

describe('while the game owns the keyboard', () => {
  it('claims its keys', () => {
    for (const code of TYPING_KEYS) {
      expect(press(code).defaultPrevented, `${code} should be claimed`).toBe(true);
      release(code);
    }
  });

  it('leaves unmapped keys alone', () => {
    expect(press('KeyQ').defaultPrevented).toBe(false);
    expect(press('Tab').defaultPrevented).toBe(false);
  });
});

describe('while a form is open', () => {
  beforeEach(() => input.setSuspended(true));

  it('lets every typing key through, including a, space and backspace', () => {
    for (const code of TYPING_KEYS) {
      expect(press(code).defaultPrevented, `${code} should reach the form`).toBe(false);
      expect(release(code).defaultPrevented, `${code} keyup should reach the form`).toBe(false);
    }
  });

  it('registers no input for the game', () => {
    press('KeyA');
    expect(input.down('left')).toBe(false);
    expect(input.pressed('left')).toBe(false);
  });

  it('takes the keyboard back when the form closes', () => {
    input.setSuspended(false);
    expect(press('KeyA').defaultPrevented).toBe(true);
  });
});

describe('when a text field is focused', () => {
  it('lets typing through even if nobody remembered to suspend', () => {
    const field = document.createElement('input');
    document.body.append(field);
    for (const code of TYPING_KEYS) {
      expect(press(code, field).defaultPrevented, `${code} in an input`).toBe(false);
    }
  });

  it('does the same for a textarea', () => {
    const area = document.createElement('textarea');
    document.body.append(area);
    expect(press('Backspace', area).defaultPrevented).toBe(false);
    expect(press('Space', area).defaultPrevented).toBe(false);
  });

  it('still claims keys pressed outside a field', () => {
    const field = document.createElement('input');
    document.body.append(field);
    expect(press('KeyA', field).defaultPrevented).toBe(false);
    expect(press('KeyA').defaultPrevented).toBe(true);
  });
});

describe('held keys', () => {
  it('does not leave a direction stuck after the window loses focus', () => {
    press('KeyD');
    expect(input.down('right')).toBe(true);
    window.dispatchEvent(new Event('blur'));
    expect(input.down('right')).toBe(false);
  });

  it('clears held keys when a form takes over mid-walk', () => {
    press('KeyD');
    input.setSuspended(true);
    expect(input.down('right')).toBe(false);
  });
});

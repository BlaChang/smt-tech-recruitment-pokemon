import type { Input } from '../engine/input';
import type { GameState } from '../state/gameState';

const MAX_LENGTH = 12;
const MAX_EMAIL = 120;

/** Same rule the registry applies, so the two prompts cannot disagree. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface NameEntryDeps {
  overlay: HTMLElement;
  input: Input;
  state: GameState;
  onClose(): void;
}

/**
 * Nickname and email prompt. Real DOM inputs rather than a canvas keyboard
 * grid: it costs nothing, and nobody wants to thumb through a letter grid
 * in 2026.
 *
 * The email is asked for here rather than only at the registry so that
 * someone who gives up halfway is still reachable. It is the one thing the
 * `abandoned` sheet could never record, and abandonment is exactly the
 * population worth following up with. The screen says so, because taking a
 * contact detail from someone who has not applied and not explaining why
 * is how you get a worse bounce rate than you started with.
 */
export function openNameEntry(deps: NameEntryDeps): void {
  const { overlay, input, state, onClose } = deps;
  input.setSuspended(true);

  const form = document.createElement('form');
  form.className = 'registry name-entry';
  form.noValidate = true;
  form.innerHTML = `
    <h2>WHAT IS YOUR NAME?</h2>
    <p class="registry-sub">The professor is waiting. It does not have to be your real one.</p>
    <label for="nickname">Nickname</label>
    <input id="nickname" name="nickname" maxlength="${MAX_LENGTH}" autocomplete="off" />
    <label for="player-email">Your email</label>
    <input id="player-email" name="email" type="email" maxlength="${MAX_EMAIL}"
      placeholder="you@stanford.edu" autocomplete="email" />
    <p class="registry-error" hidden></p>
    <div class="registry-actions"><button type="submit">THAT'S ME</button></div>
  `;

  const field = form.querySelector<HTMLInputElement>('#nickname');
  const emailField = form.querySelector<HTMLInputElement>('#player-email');
  const error = form.querySelector<HTMLParagraphElement>('.registry-error');

  const fail = (message: string): void => {
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = (field?.value ?? '').trim().slice(0, MAX_LENGTH);
    if (!value) {
      fail('The professor needs something to call you.');
      return;
    }
    const email = (emailField?.value ?? '').trim().slice(0, MAX_EMAIL);
    if (!EMAIL.test(email)) {
      fail('That email does not look right.');
      return;
    }
    state.playerName = value;
    state.playerEmail = email;
    overlay.replaceChildren();
    overlay.classList.remove('active');
    input.setSuspended(false);
    onClose();
  });

  overlay.replaceChildren(form);
  overlay.classList.add('active');
  field?.focus();
}

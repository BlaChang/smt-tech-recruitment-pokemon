import type { Input } from '../engine/input';
import type { GameState } from '../state/gameState';

const MAX_LENGTH = 12;

export interface NameEntryDeps {
  overlay: HTMLElement;
  input: Input;
  state: GameState;
  onClose(): void;
}

/**
 * Nickname prompt. A real DOM input rather than a canvas keyboard grid: it
 * costs nothing, and nobody wants to thumb through a letter grid in 2026.
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
    <p class="registry-error" hidden></p>
    <div class="registry-actions"><button type="submit">THAT'S ME</button></div>
  `;

  const field = form.querySelector<HTMLInputElement>('#nickname');
  const error = form.querySelector<HTMLParagraphElement>('.registry-error');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = (field?.value ?? '').trim().slice(0, MAX_LENGTH);
    if (!value) {
      if (error) {
        error.textContent = 'The professor needs something to call you.';
        error.hidden = false;
      }
      return;
    }
    state.playerName = value;
    overlay.replaceChildren();
    overlay.classList.remove('active');
    input.setSuspended(false);
    onClose();
  });

  overlay.replaceChildren(form);
  overlay.classList.add('active');
  field?.focus();
}

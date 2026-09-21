import type { Input } from '../engine/input';
import type { GameState } from '../state/gameState';
import type { Application, Telemetry } from './telemetry';

interface Field {
  name: keyof Application;
  label: string;
  type: 'text' | 'email' | 'textarea';
  placeholder: string;
  required: boolean;
  maxLength: number;
}

const FIELDS: Field[] = [
  {
    name: 'email',
    label: 'Your email',
    type: 'email',
    placeholder: 'you@stanford.edu',
    required: true,
    maxLength: 120,
  },
  { name: 'name', label: 'Your actual name', type: 'text', placeholder: '', required: true, maxLength: 80 },
  {
    name: 'year',
    label: 'Year + what you already know',
    type: 'text',
    placeholder: 'Frosh, some Python, zero web',
    required: false,
    maxLength: 160,
  },
  {
    name: 'link',
    label: 'A link, if you have one',
    type: 'text',
    placeholder: 'github / site / anything',
    required: false,
    maxLength: 200,
  },
  {
    name: 'built',
    label: 'Weirdest or coolest thing you have built',
    type: 'textarea',
    placeholder: 'It does not have to be impressive. It has to be yours.',
    required: false,
    maxLength: 900,
  },
];

export interface RegistryDeps {
  overlay: HTMLElement;
  input: Input;
  state: GameState;
  telemetry: Telemetry;
  onClose(applied: boolean): void;
}

/**
 * The application itself, as a DOM overlay rather than in-canvas text entry —
 * real inputs mean autofill, paste, and IME all just work.
 */
export function openRegistry(deps: RegistryDeps): void {
  const { overlay, input, state, telemetry, onClose } = deps;
  input.setSuspended(true);

  const form = document.createElement('form');
  form.className = 'registry';
  form.noValidate = true;
  form.innerHTML = `
    <h2>THE GYM REGISTRY</h2>
    <p class="registry-sub">Leave ARPIT your email. Everything below it is optional and we do read it.</p>
    ${FIELDS.map(fieldHtml).join('')}
    <p class="registry-error" hidden></p>
    <div class="registry-actions">
      <button type="submit">SIGN THE REGISTRY</button>
      <button type="button" data-cancel>Not yet</button>
    </div>
  `;

  const error = form.querySelector<HTMLParagraphElement>('.registry-error');
  const submitButton = form.querySelector<HTMLButtonElement>('button[type=submit]');

  const close = (applied: boolean): void => {
    overlay.replaceChildren();
    overlay.classList.remove('active');
    input.setSuspended(false);
    onClose(applied);
  };

  form.querySelector('[data-cancel]')?.addEventListener('click', () => close(false));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const application = Object.fromEntries(
      FIELDS.map((f) => [f.name, String(data.get(f.name) ?? '').trim()]),
    ) as unknown as Application;

    const problem = validate(application);
    if (problem) {
      if (error) {
        error.textContent = problem;
        error.hidden = false;
      }
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'SIGNING...';
    }

    const ok = await telemetry.submitApplication(application);
    if (!ok) {
      if (error) {
        error.textContent = 'That did not send. Check your connection and try again.';
        error.hidden = false;
      }
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'SIGN THE REGISTRY';
      }
      return;
    }

    state.applied = true;
    close(true);
  });

  const nameField = form.querySelector<HTMLInputElement>('[name=name]');
  if (nameField && state.playerName) nameField.value = state.playerName;

  overlay.replaceChildren(form);
  overlay.classList.add('active');
  form.querySelector<HTMLInputElement>('[name=email]')?.focus();
}

function fieldHtml(field: Field): string {
  const id = `registry-${field.name}`;
  const control =
    field.type === 'textarea'
      ? `<textarea id="${id}" name="${field.name}" rows="3" maxlength="${field.maxLength}" placeholder="${field.placeholder}"></textarea>`
      : `<input id="${id}" name="${field.name}" type="${field.type}" maxlength="${field.maxLength}" placeholder="${field.placeholder}" />`;
  return `<label for="${id}">${field.label}${field.required ? '' : ' <em>(optional)</em>'}</label>${control}`;
}

/** Returns an error message, or null when the application is good to send. */
export function validate(application: Application): string | null {
  for (const field of FIELDS) {
    if (field.required && !application[field.name]) return `${field.label} is required.`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email)) return 'That email does not look right.';
  return null;
}

import type { Input } from '../engine/input';
import type { GameState } from '../state/gameState';
import type { Application, Telemetry } from './telemetry';
import { MORE_INFO } from '../content/links';

interface Field {
  name: keyof Application;
  label: string;
  type: 'text' | 'email' | 'textarea' | 'select';
  placeholder: string;
  required: boolean;
  maxLength: number;
  /** For `select` only: the choices, in order. */
  options?: readonly string[];
}

/**
 * Year options. Kept as a fixed list so the sheet column can be sorted and
 * counted -- free text gave "frosh", "1st year", "freshman" and "Frosh (gap
 * year)" for the same answer.
 */
export const YEARS = [
  'Frosh',
  'Sophomore',
  'Junior',
  'Senior',
  'Grad student',
] as const;

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
    label: 'Year',
    type: 'select',
    placeholder: 'Pick one',
    required: false,
    maxLength: 20,
    options: YEARS,
  },
  {
    name: 'experience',
    label: 'What you already know',
    type: 'textarea',
    placeholder: 'Some Python, zero web. "Nothing yet" is a real answer.',
    required: false,
    maxLength: 400,
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
    <p class="registry-sub">
      <a class="registry-info" href="${MORE_INFO.url}" target="_blank" rel="noopener noreferrer"
        >${MORE_INFO.label} ↗</a>
    </p>
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
  const rows = field.name === 'experience' ? 2 : 3;
  let control: string;
  if (field.type === 'select') {
    // Blank first, and selected, so an optional dropdown does not quietly
    // answer itself with whatever happens to be at the top of the list.
    const options = [
      `<option value="" selected>${field.placeholder}</option>`,
      ...(field.options ?? []).map((o) => `<option value="${o}">${o}</option>`),
    ].join('');
    control = `<select id="${id}" name="${field.name}">${options}</select>`;
  } else if (field.type === 'textarea') {
    control = `<textarea id="${id}" name="${field.name}" rows="${rows}" maxlength="${field.maxLength}" placeholder="${field.placeholder}"></textarea>`;
  } else {
    control = `<input id="${id}" name="${field.name}" type="${field.type}" maxlength="${field.maxLength}" placeholder="${field.placeholder}" />`;
  }
  return `<label for="${id}">${field.label}${field.required ? '' : ' <em>(optional)</em>'}</label>${control}`;
}

/** Returns an error message, or null when the application is good to send. */
export function validate(application: Application): string | null {
  for (const field of FIELDS) {
    if (field.required && !application[field.name]) return `${field.label} is required.`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email)) return 'That email does not look right.';
  // Blank is fine -- the dropdown starts there and the field is optional --
  // but anything else must be one of ours, or the sheet column stops being
  // countable and we would not notice until someone tried to sort it.
  if (application.year && !(YEARS as readonly string[]).includes(application.year)) {
    return 'Pick a year from the list.';
  }
  return null;
}

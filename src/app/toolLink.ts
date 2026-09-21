import { GL2_CALCULATOR_URL, hasGl2Calculator } from './config';

const ID = 'gl2-link';

/**
 * Reveals the GF(2) calculator link beneath the canvas once the puzzle NPC
 * hands it over. A plain anchor rather than a popup: no blocked windows, and
 * the player decides when to open it.
 */
export function revealGl2Link(): void {
  if (!hasGl2Calculator() || document.getElementById(ID)) return;

  const link = document.createElement('a');
  link.id = ID;
  link.href = GL2_CALCULATOR_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'PUZZLER gave you a GF(2) solver ↗';
  document.querySelector('#hint')?.after(link);
}

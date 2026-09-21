const ID = 'project-link';

/**
 * Shows a clickable link to a project beneath the canvas.
 *
 * A real anchor rather than window.open: the game reads input on its own
 * loop rather than inside the key event, so a popup opened from there is
 * blocked. Clicking a link the player can see always works, and lets them
 * decide when to leave the page.
 */
export function showProjectLink(name: string, url: string): void {
  clearProjectLink();
  if (!url) return;

  const link = document.createElement('a');
  link.id = ID;
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = `Open ${name} ↗`;
  document.querySelector('#hint')?.after(link);
}

export function clearProjectLink(): void {
  document.getElementById(ID)?.remove();
}

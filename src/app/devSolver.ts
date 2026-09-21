import { isSolved, SIZE, solve } from '../puzzle/lightsOut';
import { PANEL_ORIGIN, PANEL_SPACING } from '../world/maps/gym';

/**
 * Dev-only helper that prints a worked solution to the Lights Out floor.
 *
 * Stripped from production builds by the import.meta.env.DEV guard, so
 * players never see it. Re-printed after every press, because pressing a
 * panel changes which presses remain.
 */

/** Map tile a board cell sits on, the inverse of panelCellAt. */
function tileFor(cell: number): { x: number; y: number } {
  return {
    x: PANEL_ORIGIN.x + (cell % SIZE) * PANEL_SPACING,
    y: PANEL_ORIGIN.y + Math.floor(cell / SIZE) * PANEL_SPACING,
  };
}

/** Board and remaining presses as two small ASCII grids. */
export function describeSolution(panels: boolean[]): string {
  if (isSolved(panels)) return 'lights out: solved';

  const presses = solve(panels);
  if (presses === null) return 'lights out: no solution exists (this should be impossible)';

  const grid = (mark: (cell: number) => string): string =>
    Array.from({ length: SIZE }, (_, row) =>
      '  ' + Array.from({ length: SIZE }, (_, col) => mark(row * SIZE + col)).join(' '),
    ).join('\n');

  const board = grid((c) => (panels[c] ? '#' : '.'));
  const plan = grid((c) => (presses.includes(c) ? 'X' : '-'));
  const coords = presses.map((c) => {
    const t = tileFor(c);
    return `(${t.x},${t.y})`;
  });

  return [
    `lights out: ${presses.length} press${presses.length === 1 ? '' : 'es'} left`,
    'board (# lit, . dark):',
    board,
    'step on X:',
    plan,
    `map tiles: ${coords.join(' ') || 'none'}`,
  ].join('\n');
}

/** Prints the solution. No-op outside dev. */
export function logSolution(panels: boolean[]): void {
  if (!import.meta.env.DEV) return;
  console.info(describeSolution(panels));
}

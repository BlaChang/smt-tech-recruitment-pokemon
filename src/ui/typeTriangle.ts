import { VIEW_W } from '../engine/config';
import type { Renderer } from '../engine/renderer';
import { TYPE_BEATS, TYPE_CYCLE, type MonType } from '../battle/teams';

/**
 * The type triangle, drawn as a diagram: three labels in a ring with arrows
 * running from each type to the one it beats.
 *
 * It is generated from TYPE_BEATS rather than hand-drawn, so it cannot fall
 * out of step with the damage calculation it is explaining.
 */

const RADIUS = 30;
const NODE_W = 30;
const NODE_H = 14;

const COLOURS: Record<MonType, string> = {
  PW: '#e05a4a',
  TD: '#4a8fe0',
  TECH: '#4ac07a',
};

function nodeCentre(index: number, cx: number, cy: number): { x: number; y: number } {
  // Start at the top and go clockwise.
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / TYPE_CYCLE.length;
  return { x: cx + Math.cos(angle) * RADIUS, y: cy + Math.sin(angle) * RADIUS };
}

export function drawTypeTriangle(r: Renderer, cy: number): void {
  const cx = VIEW_W / 2;
  const centres = TYPE_CYCLE.map((_, i) => nodeCentre(i, cx, cy));

  // Arrows first, so the labels sit on top of them.
  TYPE_CYCLE.forEach((type, i) => {
    const target = TYPE_CYCLE.indexOf(TYPE_BEATS[type]);
    drawArrow(r, centres[i], centres[target], COLOURS[type]);
  });

  TYPE_CYCLE.forEach((type, i) => {
    const c = centres[i];
    const x = Math.round(c.x - NODE_W / 2);
    const y = Math.round(c.y - NODE_H / 2);
    r.rect(x, y, NODE_W, NODE_H, '#1b1830', true);
    r.strokeRect(x, y, NODE_W, NODE_H, COLOURS[type], true);
    r.textCentered(type, c.x, c.y - 4, COLOURS[type], 8, true);
  });
}

/** A line from just outside one node to just outside the next, with a head. */
function drawArrow(
  r: Renderer,
  from: { x: number; y: number },
  to: { x: number; y: number },
  colour: string,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // Back both ends off so the line does not run under the labels.
  const inset = 17;
  const x1 = from.x + ux * inset;
  const y1 = from.y + uy * inset;
  const x2 = to.x - ux * inset;
  const y2 = to.y - uy * inset;
  r.line(x1, y1, x2, y2, colour);

  // Arrowhead: two short strokes swept back from the tip.
  const head = 4;
  for (const sweep of [2.6, -2.6]) {
    const ax = Math.cos(Math.atan2(uy, ux) + sweep) * head;
    const ay = Math.sin(Math.atan2(uy, ux) + sweep) * head;
    r.line(x2, y2, x2 + ax, y2 + ay, colour);
  }
}

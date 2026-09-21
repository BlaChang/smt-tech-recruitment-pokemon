import { TILE } from '../engine/config';
import type { Renderer } from '../engine/renderer';
import type { Script } from '../content/script';
import { drawCharacter } from './characterSprite';
import type { Direction } from './direction';

export interface NpcDef {
  id: string;
  x: number;
  y: number;
  facing: Direction;
  /** Placeholder body color until sprites land. */
  color: string;
  /** Two-letter tag drawn on the placeholder sprite. */
  tag: string;
  script: Script;
  /** Most NPCs turn to look at you; the leader holds her pose. */
  turnsToFace?: boolean;
}

export class Npc {
  facing: Direction;

  constructor(readonly def: NpcDef) {
    this.facing = def.facing;
  }

  get x(): number {
    return this.def.x;
  }

  get y(): number {
    return this.def.y;
  }

  render(r: Renderer): void {
    const px = this.x * TILE;
    const py = this.y * TILE;
    if (drawCharacter(r, `char:${this.def.id}`, px, py, this.facing, 0, false)) return;

    r.rect(px + 2, py + 1, TILE - 4, TILE - 2, this.def.color);
    r.strokeRect(px + 2, py + 1, TILE - 4, TILE - 2, '#2a2438');
    r.text(this.def.tag, px + 4, py + 4, '#ffffff', 7);
    drawFacingPip(r, px, py, this.facing);
  }
}

/** A light pip on the leading edge so facing is readable without real sprites. */
export function drawFacingPip(r: Renderer, px: number, py: number, facing: Direction): void {
  const c = '#fdf6e3';
  if (facing === 'up') r.rect(px + 6, py + 1, 4, 2, c);
  else if (facing === 'down') r.rect(px + 6, py + TILE - 3, 4, 2, c);
  else if (facing === 'left') r.rect(px + 2, py + 6, 2, 4, c);
  else r.rect(px + TILE - 4, py + 6, 2, 4, c);
}

import type { NpcDef } from '../world/npc';
import { ROOMS } from '../world/maps/rooms';
import { LEADER_TILE } from '../world/maps/gym';
import {
  GREETER,
  LEADER,
  NPC_BUILD,
  NPC_CURATOR,
  NPC_HINT,
  NPC_ROOKIE,
  NPC_SCALE,
  NPC_SHIPPER,
  NPC_WACKY,
  NPC_WARSTORY,
  RIVAL_ENCOUNTER,
} from './dialogue';
import { rivalFor } from '../battle/rivals';

/** Room-local coordinates, resolved to absolute tiles below. */
function inRoom(id: string, dx: number, dy: number): { x: number; y: number } {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) throw new Error(`Unknown room: ${id}`);
  return { x: room.x + dx, y: room.y + dy };
}

/**
 * Placements are room-relative so moving a room in rooms.ts carries its
 * people with it. Each NPC still carries exactly one idea about SMT.
 */
export const NPCS: NpcDef[] = [
  {
    id: 'greeter',
    ...inRoom('entry', 7, 5),
    facing: 'down',
    color: '#c1553f',
    tag: 'FD',
    script: GREETER,
    turnsToFace: true,
  },
  {
    id: 'scale',
    ...inRoom('entry', 4, 4),
    facing: 'down',
    color: '#4a7fc1',
    tag: 'LG',
    script: NPC_SCALE,
    turnsToFace: true,
  },
  {
    id: 'build',
    ...inRoom('entry', 10, 4),
    facing: 'down',
    color: '#3f9e6a',
    tag: 'EN',
    script: NPC_BUILD,
    turnsToFace: true,
  },
  {
    id: 'warstory',
    ...inRoom('entry', 4, 7),
    facing: 'right',
    color: '#8a5ea8',
    tag: 'VT',
    script: NPC_WARSTORY,
    turnsToFace: true,
  },
  {
    id: 'wacky',
    ...inRoom('entry', 10, 7),
    facing: 'left',
    color: '#d4a02a',
    tag: 'GR',
    script: NPC_WACKY,
    turnsToFace: true,
  },
  {
    // Stationed with the light panels, which is the puzzle he talks about.
    id: 'hint',
    ...inRoom('panels', 10, 8),
    facing: 'left',
    color: '#5f7d95',
    tag: 'PZ',
    script: NPC_HINT,
    turnsToFace: true,
  },
  // The Hall of Fame's three. They stand clear of the dx6/dx7 column the
  // player walks up, and clear of the tiles you stand on to read a display,
  // so nobody can be blocked out of a project by someone standing in front
  // of it.
  {
    id: 'curator',
    ...inRoom('hall', 4, 9),
    facing: 'right',
    color: '#8a8fae',
    tag: 'HF',
    script: NPC_CURATOR,
    turnsToFace: true,
  },
  {
    id: 'shipper',
    ...inRoom('hall', 10, 6),
    facing: 'left',
    color: '#3f9e6a',
    tag: 'OC',
    script: NPC_SHIPPER,
    turnsToFace: true,
  },
  {
    id: 'rookie',
    ...inRoom('hall', 3, 3),
    facing: 'down',
    color: '#d4643c',
    tag: 'FY',
    script: NPC_ROOKIE,
    turnsToFace: true,
  },
  {
    // Which rival this is depends on the starter, so the sprite is resolved
    // at draw time rather than baked in here.
    id: 'rival',
    ...inRoom('rival', 7, 4),
    facing: 'down',
    color: '#d4643c',
    tag: 'RV',
    script: RIVAL_ENCOUNTER,
    turnsToFace: true,
    spriteFor: (state) => `char:${rivalFor(state.starter).sprite}`,
  },
  {
    id: 'leader',
    ...LEADER_TILE,
    facing: 'down',
    color: '#b8336a',
    tag: 'AR',
    script: LEADER,
    turnsToFace: false,
  },
];

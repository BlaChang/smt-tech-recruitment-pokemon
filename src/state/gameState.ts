import { PLAYER_SPAWN } from '../world/maps/gym';
import type { Direction } from '../world/direction';
import { seedBoard } from '../puzzle/lightsOut';
import { initialBoulders, initialGates, PANEL_CELLS } from '../world/puzzleSetup';

export { PANEL_CELLS };

export interface GameState {
  /** Nickname the player types at the professor's intro. */
  playerName: string;
  flags: Set<string>;

  /** Room 1: 2x2 Lights Out board, row-major, true = lit. */
  panels: boolean[];
  panelPresses: number;

  /** Room 2: pushable crates and the sockets they belong in. */
  boulders: Array<{ x: number; y: number }>;
  boulderPushes: number;

  /** Room 3: rotating gates, keyed by id, storing which arms stick out. */
  gates: Array<{ id: string; arms: Direction[] }>;
  gateTurns: number;

  puzzleSolvedAtMs: number | null;
  starter: string | null;
  battleWon: boolean;
  battleTurns: number;
  mathAttempts: number;
  applied: boolean;
  playerX: number;
  playerY: number;
  facing: Direction;
  startedAtMs: number;
}

export function createGameState(): GameState {
  return {
    playerName: '',
    flags: new Set<string>(),
    // Seeded from a solved board, so it is always reachable.
    panels: seedBoard(),
    panelPresses: 0,
    boulders: initialBoulders(),
    boulderPushes: 0,
    gates: initialGates(),
    gateTurns: 0,
    puzzleSolvedAtMs: null,
    starter: null,
    battleWon: false,
    battleTurns: 0,
    mathAttempts: 0,
    applied: false,
    playerX: PLAYER_SPAWN.x,
    playerY: PLAYER_SPAWN.y,
    facing: PLAYER_SPAWN.facing,
    startedAtMs: Date.now(),
  };
}

export function hasFlag(state: GameState, flag: string): boolean {
  return state.flags.has(flag);
}

export function setFlag(state: GameState, flag: string): void {
  state.flags.add(flag);
}

/** NPC flags all share a prefix so progress counting stays a one-liner. */
export const TALKED_PREFIX = 'talked:';

export function npcsTalkedTo(state: GameState): string[] {
  return [...state.flags]
    .filter((f) => f.startsWith(TALKED_PREFIX))
    .map((f) => f.slice(TALKED_PREFIX.length));
}

/** Every puzzle the player has finished, for telemetry. */
export function puzzlesSolved(state: GameState): string[] {
  return ['panels', 'boulders', 'gates'].filter((p) => state.flags.has(`puzzle:${p}`));
}

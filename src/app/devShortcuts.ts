import { setFlag, type GameState } from '../state/gameState';
import { ROOMS } from '../world/maps/rooms';

/**
 * Dev-only stage warps, so playtesting the arena does not mean re-solving
 * three puzzles. Stripped from production builds by the import.meta.env.DEV
 * guard.
 *
 * Usage: ?dev=<stage> where stage is one of
 *   intro play panels boulders gates arena battle won registry
 */
export type DevStage =
  | 'intro'
  | 'play'
  | 'panels'
  | 'boulders'
  | 'gates'
  | 'arena'
  | 'battle'
  | 'won'
  | 'registry';

const STAGES: DevStage[] = [
  'intro', 'play', 'panels', 'boulders', 'gates', 'arena', 'battle', 'won', 'registry',
];

/** Drops the player just inside a room, with the puzzles before it solved. */
function enter(state: GameState, roomId: string, solved: string[]): void {
  const room = ROOMS.find((r) => r.id === roomId);
  if (!room) return;
  for (const flag of solved) setFlag(state, `puzzle:${flag}`);
  state.playerX = room.x + Math.floor(room.rows[0].length / 2) - 1;
  state.playerY = room.y + room.rows.length - 3;
  state.facing = 'up';
}

export function applyDevShortcut(state: GameState): DevStage | null {
  if (!import.meta.env.DEV) return null;

  const stage = new URLSearchParams(window.location.search).get('dev') as DevStage | null;
  if (!stage) return null;
  if (!STAGES.includes(stage)) {
    console.warn(`[dev] unknown stage "${stage}"; expected ${STAGES.join('|')}`);
    return null;
  }

  state.playerName = state.playerName || 'ADA';
  if (stage !== 'intro') {
    // ?starter=<id> so a specific mon's art can be checked in battle.
    const wanted = new URLSearchParams(window.location.search).get('starter');
    state.starter = wanted ?? state.starter ?? 'francis';
    setFlag(state, 'starter:chosen');
  }

  switch (stage) {
    case 'intro':
    case 'play':
      break;
    case 'panels':
      enter(state, 'panels', []);
      break;
    case 'boulders':
      enter(state, 'boulders', ['panels']);
      break;
    case 'gates':
      enter(state, 'gates', ['panels', 'boulders']);
      break;
    case 'arena':
    case 'battle':
    case 'registry':
      enter(state, 'arena', ['panels', 'boulders', 'gates']);
      break;
    case 'won':
      enter(state, 'arena', ['panels', 'boulders', 'gates']);
      state.battleWon = true;
      break;
  }

  console.info(`[dev] starting at stage "${stage}"`);
  return stage;
}

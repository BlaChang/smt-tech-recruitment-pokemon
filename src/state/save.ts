import { createGameState, type GameState } from './gameState';

const KEY = 'smt-tech-gym:save:v3';

type SavePayload = Omit<GameState, 'flags'> & { flags: string[] };

export function save(state: GameState): void {
  const payload: SavePayload = { ...state, flags: [...state.flags] };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Private browsing or a full quota. Losing the save is survivable; crashing is not.
  }
}

export function load(): GameState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SavePayload>;
    const fresh = createGameState();
    return {
      ...fresh,
      ...parsed,
      flags: new Set(parsed.flags ?? []),
      // A board of the wrong length (an older build) would desync the room.
      panels:
        Array.isArray(parsed.panels) && parsed.panels.length === fresh.panels.length
          ? parsed.panels
          : fresh.panels,
    };
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

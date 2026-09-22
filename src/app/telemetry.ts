import { npcsTalkedTo, puzzlesSolved, type GameState } from '../state/gameState';
import { hasEndpoint, SHEETS_ENDPOINT, SUBMIT_TOKEN } from './config';

export interface Application {
  email: string;
  name: string;
  /** One of `YEARS` in registry.ts, or '' when not answered. */
  year: string;
  experience: string;
  link: string;
  built: string;
}

export interface TelemetrySnapshot {
  sessionId: string;
  playerName: string;
  msElapsed: number;
  stage: string;
  npcsTalkedTo: string[];
  starter: string | null;
  milestones: string[];
  panelPresses: number;
  rivalTurns: number;
  puzzleSolvedMs: number | null;
  battleTurns: number;
  battleWon: boolean;
  mathAttempts: number;
  events: string[];
}

const SESSION_KEY = 'smt-tech-gym:session';

function sessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export class Telemetry {
  readonly sessionId = sessionId();
  private events: string[] = [];
  private submitted = false;

  constructor(private getState: () => GameState) {}

  track(event: string, data?: Record<string, unknown>): void {
    const suffix = data ? ` ${JSON.stringify(data)}` : '';
    const at = Math.round((Date.now() - this.getState().startedAtMs) / 1000);
    this.events.push(`${at}s ${event}${suffix}`);
    if (!hasEndpoint()) console.info('[telemetry]', event, data ?? '');
  }

  snapshot(): TelemetrySnapshot {
    const state = this.getState();
    return {
      sessionId: this.sessionId,
      playerName: state.playerName,
      msElapsed: Date.now() - state.startedAtMs,
      stage: currentStage(state),
      npcsTalkedTo: npcsTalkedTo(state),
      starter: state.starter,
      milestones: puzzlesSolved(state),
      panelPresses: state.panelPresses,
      rivalTurns: state.rivalTurns,
      puzzleSolvedMs: state.puzzleSolvedAtMs,
      battleTurns: state.battleTurns,
      battleWon: state.battleWon,
      mathAttempts: state.mathAttempts,
      events: this.events,
    };
  }

  /** Resolves false when the row did not land, so the UI can offer a retry. */
  async submitApplication(application: Application): Promise<boolean> {
    const payload = {
      kind: 'application',
      token: SUBMIT_TOKEN,
      application,
      telemetry: this.snapshot(),
    };

    if (!hasEndpoint()) {
      console.info('[registry] no endpoint configured; payload was:', payload);
      return true;
    }

    try {
      // text/plain dodges the CORS preflight that Apps Script cannot answer.
      const res = await fetch(SHEETS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });
      this.submitted = res.ok;
      return res.ok;
    } catch (err) {
      console.warn('[registry] submit failed', err);
      return false;
    }
  }

  /**
   * Fires once on tab close so the hard gate's drop-off is measurable. Uses
   * sendBeacon because fetch is not guaranteed to survive unload.
   */
  attachAbandonBeacon(): void {
    const send = (): void => {
      if (this.submitted || !hasEndpoint()) return;
      const state = this.getState();
      if (state.applied) return;
      const payload = JSON.stringify({
        kind: 'abandoned',
        token: SUBMIT_TOKEN,
        telemetry: this.snapshot(),
      });
      try {
        navigator.sendBeacon(SHEETS_ENDPOINT, new Blob([payload], { type: 'text/plain;charset=utf-8' }));
      } catch {
        /* nothing useful to do during unload */
      }
    };
    window.addEventListener('pagehide', send);
  }
}

/** Coarse funnel bucket, so the sheet shows where people stop. */
export function currentStage(state: GameState): string {
  if (state.applied) return 'applied';
  if (state.battleWon) return 'beat-leader';
  if (state.flags.has('rival:beaten')) return 'beat-rival';
  if (state.flags.has('puzzle:panels')) return 'cleared-panels';
  if (state.panelPresses > 0) return 'attempting-panels';
  if (state.starter) return 'has-team';
  return 'entered';
}

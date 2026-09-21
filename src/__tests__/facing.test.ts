import { describe, expect, it } from 'vitest';
import { facesAway } from '../battle/facing';
import { LEADER_TEAM, STARTERS, type MonSpec } from '../battle/teams';
import { rivalFor, rivalTeam } from '../battle/rivals';

const ALL: MonSpec[] = [...STARTERS, ...LEADER_TEAM];

describe('which way a mon looks', () => {
  it('turns every mon toward its opponent, whichever side it is on', () => {
    // The rule that matters: after mirroring, the player's mon looks right
    // and the foe looks left, so the two of them face each other.
    for (const spec of ALL) {
      const drawn = spec.faces ?? 'left';
      const after = (isFoe: boolean) => {
        const flipped = facesAway(spec, isFoe);
        return flipped ? (drawn === 'left' ? 'right' : 'left') : drawn;
      };
      expect(after(false), `${spec.name} on your side`).toBe('right');
      expect(after(true), `${spec.name} as the foe`).toBe('left');
    }
  });

  it('leaves art alone when it already points the right way', () => {
    const goose = STARTERS.find((s) => s.id === 'goose');
    expect(goose?.faces, 'GOOSE is drawn facing right').toBe('right');
    expect(facesAway(goose as MonSpec, false), 'no mirror needed on your side').toBe(false);
    const francis = STARTERS.find((s) => s.id === 'francis');
    expect(facesAway(francis as MonSpec, true), 'no mirror needed as the foe').toBe(false);
  });

  it('follows a starter into the rival who copies it', () => {
    // Rival teams are built from the starter specs, so the facing has to
    // survive the copy or Calista's GOOSE turns its back on you.
    for (const starter of STARTERS) {
      const copy = rivalTeam(rivalFor(starter.id))[0];
      const original = STARTERS.find((s) => s.id === copy.id);
      expect(copy.faces, `${copy.name} lost its facing`).toBe(original?.faces);
    }
  });
});

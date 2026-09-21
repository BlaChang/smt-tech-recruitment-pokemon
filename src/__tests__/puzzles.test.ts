import { describe, expect, it } from 'vitest';
import * as Boulders from '../puzzle/boulders';
import { armTiles, gateAt, hubAt, pushArm, rotateDirection, type Gate } from '../puzzle/gates';
import type { Direction } from '../world/direction';

const open = () => true;

function state(boulders: Array<[number, number]>, sockets: Array<[number, number]>): Boulders.BoulderState {
  return {
    boulders: boulders.map(([x, y]) => ({ x, y })),
    sockets: sockets.map(([x, y]) => ({ x, y })),
  };
}

describe('crates', () => {
  it('slides a crate one square when the way beyond is clear', () => {
    const s = state([[5, 5]], [[5, 1]]);
    expect(Boulders.push(s, 5, 5, 'up', open)).toBe(true);
    expect(s.boulders[0]).toEqual({ x: 5, y: 4 });
  });

  it('refuses to push a crate into a wall', () => {
    const s = state([[5, 5]], []);
    const blocked = (x: number, y: number) => !(x === 5 && y === 4);
    expect(Boulders.push(s, 5, 5, 'up', blocked)).toBe(false);
    expect(s.boulders[0]).toEqual({ x: 5, y: 5 });
  });

  it('refuses to push a crate into another crate', () => {
    const s = state([[5, 5], [5, 4]], []);
    expect(Boulders.push(s, 5, 5, 'up', open)).toBe(false);
    expect(s.boulders[0]).toEqual({ x: 5, y: 5 });
  });

  it('does nothing when there is no crate on the square', () => {
    const s = state([[5, 5]], []);
    expect(Boulders.push(s, 1, 1, 'up', open)).toBe(false);
  });

  it('is solved only once every socket holds a crate', () => {
    const s = state([[5, 5], [9, 5]], [[5, 1], [9, 1]]);
    expect(Boulders.isSolved(s)).toBe(false);
    s.boulders[0] = { x: 5, y: 1 };
    expect(Boulders.isSolved(s)).toBe(false);
    s.boulders[1] = { x: 9, y: 1 };
    expect(Boulders.isSolved(s)).toBe(true);
  });

  it('puts every crate back on reset', () => {
    const s = state([[5, 5]], []);
    Boulders.push(s, 5, 5, 'up', open);
    Boulders.reset(s, [{ x: 5, y: 5 }]);
    expect(s.boulders).toEqual([{ x: 5, y: 5 }]);
  });
});

function gate(arms: Direction[]): Gate {
  return { id: 'g', x: 5, y: 5, arms: [...arms] };
}

describe('rotating gates', () => {
  it('rotates directions clockwise', () => {
    expect(rotateDirection('up', 1)).toBe('right');
    expect(rotateDirection('left', 1)).toBe('up');
    expect(rotateDirection('up', -1)).toBe('left');
    expect(rotateDirection('up', 4)).toBe('up');
  });

  it('places arms adjacent to the hub', () => {
    const tiles = armTiles(gate(['left', 'right']));
    expect(tiles.map((t) => [t.x, t.y]).sort()).toEqual([[4, 5], [6, 5]]);
  });

  it('reports hub and arms as blocking', () => {
    const g = [gate(['left', 'right'])];
    expect(hubAt(g, 5, 5)).toBeDefined();
    expect(gateAt(g, 4, 5)).toBeDefined();
    expect(gateAt(g, 5, 4)).toBeUndefined();
  });

  it('turns a horizontal gate upright when an arm is pushed from below', () => {
    const g = gate(['left', 'right']);
    const result = pushArm([g], 4, 5, 'up', () => false);
    expect(result.advance).toBe(true);
    expect(new Set(g.arms)).toEqual(new Set(['up', 'down']));
    // The pushed square is now clear for the player to step into.
    expect(armTiles(g).some((a) => a.x === 4 && a.y === 5)).toBe(false);
  });

  it('will not turn when an arm would sweep into a wall', () => {
    const g = gate(['left', 'right']);
    const blocked = (x: number, y: number) => x === 5 && y === 4; // above the hub
    const result = pushArm([g], 4, 5, 'up', blocked);
    expect(result.advance).toBe(false);
    expect(g.arms).toEqual(['left', 'right']);
  });

  it('does nothing when an arm is shoved along its own axis', () => {
    const g = gate(['left', 'right']);
    // Walking right into the left-hand arm drives it straight at the hub.
    const result = pushArm([g], 4, 5, 'right', () => false);
    expect(result.advance).toBe(false);
    expect(g.arms).toEqual(['left', 'right']);
  });

  it('is reversible: four pushes from the same side return it to the start', () => {
    const g = gate(['left', 'right']);
    const start = [...g.arms].sort();
    for (let i = 0; i < 4; i++) {
      const arm = armTiles(g)[0];
      const dir: Direction = arm.dir === 'left' || arm.dir === 'right' ? 'up' : 'right';
      pushArm([g], arm.x, arm.y, dir, () => false);
    }
    expect([...g.arms].sort()).toEqual(start);
  });
});

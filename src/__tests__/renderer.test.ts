import { describe, expect, it } from 'vitest';
import { Renderer } from '../engine/renderer';

interface Call {
  op: string;
  x: number;
  y: number;
  text?: string;
}

/** A canvas stand-in that records where each draw actually landed. */
function recordingRenderer(): { renderer: Renderer; calls: Call[] } {
  const calls: Call[] = [];
  const ctx = {
    imageSmoothingEnabled: true,
    textBaseline: 'alphabetic',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    fillRect: (x: number, y: number) => calls.push({ op: 'rect', x, y }),
    strokeRect: (x: number, y: number) => calls.push({ op: 'stroke', x, y }),
    fillText: (text: string, x: number, y: number) => calls.push({ op: 'text', x, y, text }),
    measureText: (s: string) => ({ width: s.length * 5 }),
  };
  const canvas = { getContext: () => ctx, style: {} } as unknown as HTMLCanvasElement;
  return { renderer: new Renderer(canvas), calls };
}

describe('renderer camera space', () => {
  it('offsets world-space text by the camera, exactly like rect', () => {
    const { renderer, calls } = recordingRenderer();
    renderer.camX = 80;
    renderer.camY = 320;

    renderer.rect(144, 448, 16, 16, '#fff');
    renderer.text('TL', 144, 448);

    const rect = calls.find((c) => c.op === 'rect');
    const text = calls.find((c) => c.op === 'text');
    expect([rect?.x, rect?.y]).toEqual([64, 128]);
    // Regression: text used to ignore the camera, so a far-off NPC's name tag
    // rendered on top of the visible map.
    expect([text?.x, text?.y]).toEqual([64, 128]);
  });

  it('leaves screen-space text where it was asked for', () => {
    const { renderer, calls } = recordingRenderer();
    renderer.camX = 80;
    renderer.camY = 320;

    renderer.text('PANELS 9/16', 9, 8, '#ffd45e', 8, true);
    renderer.textCentered('TECH GYM', 120, 38, '#ffd45e', 20, true);

    const [hud, centered] = calls.filter((c) => c.op === 'text');
    expect([hud.x, hud.y]).toEqual([9, 8]);
    expect(centered.y).toBe(38);
    expect(centered.x).toBe(120 - ('TECH GYM'.length * 5) / 2);
  });

  it('clamps the camera to the map instead of showing past the edge', () => {
    const { renderer } = recordingRenderer();
    renderer.centerOn(0, 0, 320, 480);
    expect([renderer.camX, renderer.camY]).toEqual([0, 0]);

    renderer.centerOn(10_000, 10_000, 320, 480);
    expect([renderer.camX, renderer.camY]).toEqual([80, 320]);
  });
});

import { describe, expect, it } from 'vitest';
import { measureText } from '../ui/bitmapFont';
import { UI_ATLAS } from '../ui/frame';
import { LEADER_TEAM, STARTERS, asRival, type MonSpec } from '../battle/teams';

/**
 * The name and type inside a databox.
 *
 * The two panels are inset by different amounts and their corners are cut,
 * so laying text out from the frame's edges overflowed both of them: the
 * player's name sat on its left border, and the four-letter TECH ran out of
 * the foe's right-hand side. These bounds are what the fix has to hold.
 *
 * Mirrors drawNameAndType in battleScene.ts. Kept in step by asserting the
 * same constants, which is cheaper than rendering and just as strict.
 */
const TEXT_PAD = 4;
const TEXT_GAP = 4;

/** Every mon that can appear on either side of the field. */
const ALL: MonSpec[] = [
  ...STARTERS,
  ...STARTERS.map(asRival),
  ...LEADER_TEAM,
];

const PANELS = ['databoxPlayer', 'databoxFoe'] as const;

function layout(panel: string, spec: MonSpec) {
  const meta = UI_ATLAS[panel];
  const [spanLeft, spanRight] = meta.textSpan ?? [0, meta.w];
  const left = spanLeft + TEXT_PAD;
  const right = spanRight - TEXT_PAD - 1;
  const typeX = right - measureText(spec.type);
  return { left, right, typeX, spanLeft, spanRight, nameEnd: left + measureText(spec.name) };
}

describe('databox text', () => {
  it('measures a real interior for both panels', () => {
    for (const panel of PANELS) {
      const span = UI_ATLAS[panel].textSpan;
      expect(span, `${panel} has no textSpan; re-run tools/extract_ui.py`).toBeDefined();
      expect(span?.[0]).toBeGreaterThanOrEqual(0);
      expect(span?.[1]).toBeLessThanOrEqual(UI_ATLAS[panel].w);
    }
  });

  it('notices that the two panels are inset differently', () => {
    // If these ever match, one fixed offset would do and this whole
    // mechanism is unnecessary. They do not match today.
    expect(UI_ATLAS.databoxPlayer.textSpan?.[0]).not.toBe(UI_ATLAS.databoxFoe.textSpan?.[0]);
  });

  it('keeps every type inside the panel it is drawn on', () => {
    for (const panel of PANELS) {
      for (const spec of ALL) {
        const { typeX, left, spanRight } = layout(panel, spec);
        const end = typeX + measureText(spec.type) + 1; // +1 for the shadow
        expect(end, `${spec.type} overflows ${panel}`).toBeLessThanOrEqual(spanRight);
        expect(typeX, `${spec.type} starts left of the interior of ${panel}`)
          .toBeGreaterThanOrEqual(left);
      }
    }
  });

  it('starts every name clear of the panel border', () => {
    for (const panel of PANELS) {
      const { left, spanLeft } = layout(panel, STARTERS[0]);
      expect(left, `names sit on the border of ${panel}`).toBeGreaterThan(spanLeft);
    }
  });

  it('fits every real name beside its type without truncating', () => {
    // Truncation exists as a backstop; no mon we actually ship should hit it.
    for (const panel of PANELS) {
      for (const spec of ALL) {
        const { nameEnd, typeX } = layout(panel, spec);
        expect(nameEnd, `${spec.name} runs into its type on ${panel}`)
          .toBeLessThanOrEqual(typeX - TEXT_GAP);
      }
    }
  });

  it('would have failed on the old fixed offsets', () => {
    // TECH on the foe panel is the case reported: 28px was reserved for a
    // type that needs 24, measured from a frame edge 8px right of where the
    // foe panel's drawing actually stops.
    const meta = UI_ATLAS.databoxFoe;
    const oldTypeX = meta.w - 28;
    const oldEnd = oldTypeX + measureText('TECH');
    expect(oldEnd, 'the reported overflow no longer reproduces').toBeGreaterThan(
      meta.textSpan?.[1] ?? meta.w,
    );
  });
});

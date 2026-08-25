import { describe, expect, it } from 'vitest';
import { OVERSHOOT_RATIO, type StatTier } from '../../graphs/statLadder';
import { buildStatLadderBar } from '../../graphs/statLadderBarLayout';

/** A escada do enunciado: F em 0, C em 50, A em 400. */
const LADDER: StatTier[] = [
  { label: 'F', minValue: 0 },
  { label: 'C', minValue: 50 },
  { label: 'A', minValue: 400 },
];

const WIDTH = 300;
const build = (value: number | null = null, ladder: StatTier[] = LADDER) =>
  buildStatLadderBar({ ladder, value, width: WIDTH });

describe('buildStatLadderBar', () => {
  it('has nothing to draw for a ladder with a single tier', () => {
    expect(build(null, [{ label: 'only', minValue: 0 }])).toBeNull();
  });

  it('has nothing to draw when the top of the ladder is zero', () => {
    expect(
      build(null, [
        { label: 'a', minValue: 0 },
        { label: 'b', minValue: 0 },
      ]),
    ).toBeNull();
  });

  it('reserves the same overflow share the radar reserves', () => {
    const layout = build()!;

    expect(layout.ladderWidth).toBeCloseTo(WIDTH / (1 + OVERSHOOT_RATIO), 5);
    expect(layout.width).toBe(WIDTH);
  });

  it('places each tier marker at its own number, not at an equal share', () => {
    const layout = build()!;
    const [first, middle, last] = layout.markers;

    expect(first!.x).toBe(0);
    // 50 out of 400 is an eighth of the ladder, and not half as on the radar.
    expect(middle!.x).toBeCloseTo(layout.ladderWidth / 8, 5);
    expect(last!.x).toBeCloseTo(layout.ladderWidth, 5);
  });

  it('stops the last tier where the ladder ends, leaving the overflow band apart', () => {
    const layout = build()!;
    const lastSegment = layout.segments.at(-1)!;

    // If the last tier took the whole bar, nobody would see where the top of the ladder is.
    expect(lastSegment.x + lastSegment.width).toBeCloseTo(layout.ladderWidth, 5);
    expect(lastSegment.label).toBe('A');
    expect(layout.overflow.x).toBeCloseTo(layout.ladderWidth, 5);
    expect(layout.overflow.x + layout.overflow.width).toBeCloseTo(WIDTH, 5);
  });

  it('covers the ladder with one segment per tier, without gaps', () => {
    const layout = build()!;

    expect(layout.segments).toHaveLength(LADDER.length);
    let cursor = 0;
    for (const segment of layout.segments) {
      expect(segment.x).toBeCloseTo(cursor, 5);
      cursor += segment.width;
    }
    expect(cursor).toBeCloseTo(layout.ladderWidth, 5);
  });

  it('places the value at its number and does not call it overflow', () => {
    const layout = build(100)!;

    expect(layout.value!.x).toBeCloseTo((100 / 400) * layout.ladderWidth, 5);
    expect(layout.value!.isOverflow).toBe(false);
    expect(layout.value!.display).toBe('100');
  });

  it('marks a value above the last tier and keeps it inside the bar', () => {
    const layout = build(100000)!;

    expect(layout.value!.isOverflow).toBe(true);
    expect(layout.value!.x).toBe(WIDTH);
  });

  it('pins a negative value to the start instead of drawing outside', () => {
    expect(build(-10)!.value!.x).toBe(0);
  });

  it('keeps the value marker inside the inset, so its dot is never clipped', () => {
    const inset = 5;
    const above = buildStatLadderBar({ ladder: LADDER, value: 100000, width: WIDTH, inset })!;
    const below = buildStatLadderBar({ ladder: LADDER, value: 0, width: WIDTH, inset })!;

    expect(above.value!.x).toBe(WIDTH - inset);
    expect(below.value!.x).toBe(inset);
  });

  it('has no value marker when the character has none', () => {
    expect(build(null)!.value).toBeNull();
  });

  it('drops labels that would collide, keeping the ends readable', () => {
    // Six tiers crammed at the base: the middle ones do not fit side by side.
    const crowded: StatTier[] = [
      { label: 'F', minValue: 0 },
      { label: 'E', minValue: 2 },
      { label: 'D', minValue: 4 },
      { label: 'C', minValue: 6 },
      { label: 'B', minValue: 8 },
      { label: 'S', minValue: 400 },
    ];
    const layout = buildStatLadderBar({ ladder: crowded, value: null, width: 120 })!;
    const shown = layout.markers.filter((marker) => marker.showLabel);

    expect(shown.length).toBeLessThan(crowded.length);
    expect(layout.markers[0]!.showLabel).toBe(true);
    expect(layout.markers.at(-1)!.showLabel).toBe(true);
  });

  it('keeps every label when there is room for all of them', () => {
    const layout = buildStatLadderBar({ ladder: LADDER, value: null, width: 600 })!;

    expect(layout.markers.every((marker) => marker.showLabel)).toBe(true);
  });

  it('accounts for the ends being drawn against the edge, not centred on their tick', () => {
    // A real case: a numeric ladder from 0 to 100 in steps of 10 at a tight width. Assuming all the
    // labels centred, "90" and "100" passed the check and came out glued to the drawing.
    const numeric: StatTier[] = Array.from({ length: 11 }, (_, index) => ({
      label: String(index * 10),
      minValue: index * 10,
    }));
    const layout = buildStatLadderBar({ ladder: numeric, value: null, width: 260 })!;
    const shown = layout.markers.filter((marker) => marker.showLabel);

    expect(shown.at(-1)!.label).toBe('100');
    expect(shown.at(-2)!.label).not.toBe('90');
  });

  it('hides the second to last label when the last one would sit on top of it', () => {
    const tight: StatTier[] = [
      { label: 'F', minValue: 0 },
      { label: 'penultimate', minValue: 98 },
      { label: 'last', minValue: 100 },
    ];
    const layout = buildStatLadderBar({ ladder: tight, value: null, width: 200 })!;

    expect(layout.markers[1]!.showLabel).toBe(false);
    expect(layout.markers[2]!.showLabel).toBe(true);
  });
});

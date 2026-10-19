import { describe, expect, it } from 'vitest';
import { eraseFillsAlongPath, eraseFillWithPath } from '../../sketch/sketchFillErase';
import { pointInFlatRings } from '../../sketch/sketchGeometry';
import type { SketchFill, SketchStroke } from '../../sketch/sketchTypes';

function square(x: number, y: number, size: number): SketchFill {
  return {
    kind: 'fill',
    color: '#ff0000',
    alpha: 1,
    rings: [[x, y, x + size, y, x + size, y + size, x, y + size]],
  };
}

/** Area covered by a fill's rings (even-odd), sampled on a unit grid. */
function area(fill: SketchFill, size: number, step = 1): number {
  let count = 0;
  for (let y = step / 2; y < size; y += step) {
    for (let x = step / 2; x < size; x += step) {
      if (pointInFlatRings(x, y, fill.rings)) count += 1;
    }
  }
  return count * step * step;
}

describe('erasing part of a fill', () => {
  it('cuts a band out of the middle and leaves two pieces', () => {
    const fill = square(0, 0, 100);
    // A horizontal drag through the middle with a 20 wide eraser (radius 10).
    const erased = eraseFillWithPath(fill, [-20, 50, 120, 50], 10);
    expect(erased).not.toBeNull();
    expect(erased).not.toBeUndefined();
    const result = erased as SketchFill;
    expect(pointInFlatRings(50, 20, result.rings)).toBe(true);
    expect(pointInFlatRings(50, 80, result.rings)).toBe(true);
    expect(pointInFlatRings(50, 50, result.rings)).toBe(false);
    expect(pointInFlatRings(50, 44, result.rings)).toBe(false);
    expect(pointInFlatRings(50, 38, result.rings)).toBe(true);
    // Two separate regions, not one polygon bridged across the cut.
    expect(result.rings.length).toBe(2);
    expect(result.color).toBe('#ff0000');
  });

  it('removes only what the eraser covered (area within a pixel of the exact answer)', () => {
    const erased = eraseFillWithPath(square(0, 0, 100), [50, 50], 20) as SketchFill;
    // 10000 minus a disc of radius 20, about 1257.
    expect(area(erased, 100)).toBeGreaterThan(10000 - 1257 - 120);
    expect(area(erased, 100)).toBeLessThan(10000 - 1257 + 120);
    // A hole inside: the outer ring plus an inner ring.
    expect(erased.rings.length).toBe(2);
    expect(pointInFlatRings(50, 50, erased.rings)).toBe(false);
    expect(pointInFlatRings(10, 10, erased.rings)).toBe(true);
  });

  it('erases a corner without disturbing the rest', () => {
    const erased = eraseFillWithPath(square(0, 0, 100), [0, 0], 30) as SketchFill;
    expect(pointInFlatRings(5, 5, erased.rings)).toBe(false);
    expect(pointInFlatRings(90, 90, erased.rings)).toBe(true);
    expect(pointInFlatRings(60, 10, erased.rings)).toBe(true);
    expect(erased.rings.length).toBe(1);
  });

  it('returns null when the whole fill is erased, and undefined when nothing was touched', () => {
    expect(eraseFillWithPath(square(0, 0, 40), [20, 20, 25, 20], 60)).toBeNull();
    expect(eraseFillWithPath(square(0, 0, 40), [500, 500], 10)).toBeUndefined();
    expect(eraseFillWithPath(square(0, 0, 40), [], 10)).toBeUndefined();
  });

  it('respects holes already in the fill', () => {
    const ringWithHole: SketchFill = {
      kind: 'fill',
      color: '#00ff00',
      alpha: 1,
      rings: [
        [0, 0, 100, 0, 100, 100, 0, 100],
        [40, 40, 60, 40, 60, 60, 40, 60],
      ],
    };
    // An eraser nowhere near the hole must not close it up or move it.
    const erased = eraseFillWithPath(ringWithHole, [95, 5], 8) as SketchFill;
    expect(pointInFlatRings(50, 50, erased.rings)).toBe(false);
    expect(pointInFlatRings(20, 50, erased.rings)).toBe(true);
    expect(pointInFlatRings(97, 3, erased.rings)).toBe(false);
  });

  it('keeps tracing accurate on a large fill', () => {
    const erased = eraseFillWithPath(square(0, 0, 3000), [1500, 1500], 100) as SketchFill;
    expect(pointInFlatRings(1500, 1500, erased.rings)).toBe(false);
    expect(pointInFlatRings(1500, 1350, erased.rings)).toBe(true);
    expect(pointInFlatRings(100, 100, erased.rings)).toBe(true);
  });
});

describe('erasing fills in an item list', () => {
  const stroke: SketchStroke = {
    kind: 'stroke',
    brush: 'pen',
    color: '#000000',
    alpha: 1,
    size: 3,
    points: [0, 50, 100, 50],
  };

  it('touches only the fills the path reaches and keeps everything else by reference', () => {
    const near = square(0, 0, 100);
    const far = square(500, 500, 100);
    const result = eraseFillsAlongPath([near, stroke, far], [50, 50, 60, 50], 10);
    expect(result.changed).toBe(true);
    expect(result.items[0]).not.toBe(near);
    expect(result.items[1]).toBe(stroke);
    expect(result.items[2]).toBe(far);
  });

  it('drops a fill that is erased completely and reports no change for a miss', () => {
    const tiny = square(0, 0, 10);
    expect(eraseFillsAlongPath([tiny, stroke], [5, 5], 50).items).toEqual([stroke]);
    const items = [tiny, stroke];
    const miss = eraseFillsAlongPath(items, [900, 900], 5);
    expect(miss.changed).toBe(false);
    expect(miss.items).toBe(items);
  });
});

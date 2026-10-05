import { describe, expect, it } from 'vitest';
import {
  flipSelectionMatrix,
  hitSelectionHandle,
  selectionDragMatrix,
  selectionHandlePoints,
  sketchShapePoints,
  transformedBoundsCorners,
} from '../../sketch/sketchSelection';

const bounds = { x: 100, y: 100, width: 200, height: 100 };

describe('selection handles', () => {
  it('hits corners, the rotate knob and the body, in that priority', () => {
    expect(hitSelectionHandle(bounds, { x: 101, y: 99 }, 12, 40)).toBe('nw');
    expect(hitSelectionHandle(bounds, { x: 299, y: 201 }, 12, 40)).toBe('se');
    expect(hitSelectionHandle(bounds, { x: 200, y: 62 }, 12, 40)).toBe('rotate');
    expect(hitSelectionHandle(bounds, { x: 200, y: 150 }, 12, 40)).toBe('move');
    expect(hitSelectionHandle(bounds, { x: 500, y: 500 }, 12, 40)).toBeNull();
  });

  it('places the knob above the top edge', () => {
    expect(selectionHandlePoints(bounds, 40).rotate).toEqual({ x: 200, y: 60 });
  });
});

describe('selection drag matrix', () => {
  it('moves by the drag delta', () => {
    const m = selectionDragMatrix('move', bounds, { x: 150, y: 150 }, { x: 170, y: 140 });
    expect(m).toMatchObject({ a: 1, d: 1, e: 20, f: -10 });
  });

  it('scales about the opposite corner, keeping it fixed', () => {
    const m = selectionDragMatrix('se', bounds, { x: 300, y: 200 }, { x: 500, y: 300 });
    const factor = Math.hypot(400, 200) / Math.hypot(200, 100);
    expect(m.a).toBeCloseTo(factor);
    // The anchor (nw) maps to itself.
    expect(m.a * 100 + m.e).toBeCloseTo(100);
    expect(m.d * 100 + m.f).toBeCloseTo(100);
  });

  it('rotates about the center and snaps near 15 degree steps', () => {
    const quarter = selectionDragMatrix('rotate', bounds, { x: 200, y: 60 }, { x: 340, y: 150 });
    expect(Math.atan2(quarter.b, quarter.a)).toBeCloseTo(Math.PI / 2);
    const nearly = selectionDragMatrix(
      'rotate',
      bounds,
      { x: 200, y: 60 },
      { x: 200 + 90 * Math.sin(0.27), y: 150 - 90 * Math.cos(0.27) },
    );
    expect(Math.atan2(nearly.b, nearly.a)).toBeCloseTo(Math.PI / 12);
  });

  it('keeps a degenerate scale drag inert', () => {
    const m = selectionDragMatrix(
      'se',
      { x: 0, y: 0, width: 0, height: 0 },
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    );
    expect(m).toMatchObject({ a: 1, d: 1, e: 0, f: 0 });
  });
});

describe('transform helpers', () => {
  it('maps box corners through a flip', () => {
    const corners = transformedBoundsCorners(bounds, flipSelectionMatrix('horizontal', bounds));
    expect(corners.slice(0, 2)).toEqual([300, 100]);
    expect(corners.slice(4, 6)).toEqual([100, 200]);
  });

  it('builds shapes from a drag', () => {
    expect(sketchShapePoints('line', { x: 0, y: 0 }, { x: 10, y: 5 })).toEqual([0, 0, 10, 5]);
    const rect = sketchShapePoints('rect', { x: 10, y: 20 }, { x: 0, y: 0 });
    expect(rect).toHaveLength(10);
    expect(rect.slice(0, 2)).toEqual(rect.slice(8, 10));
    const ellipse = sketchShapePoints('ellipse', { x: 0, y: 0 }, { x: 20, y: 10 });
    expect(ellipse[0]).toBeCloseTo(20);
    expect(ellipse[1]).toBeCloseTo(5);
    expect(ellipse).toHaveLength(98);
  });
});

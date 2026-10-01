import { describe, expect, it } from 'vitest';
import type { CanvasOverlayType } from '../../schemas/CanvasOverlaySchemas';
import {
  canvasOverlayArrowhead,
  canvasOverlayEllipsePath,
  canvasOverlayFinalAngle,
  canvasOverlayPolylinePath,
  canvasOverlayPresetPoints,
  canvasOverlayRectPath,
  hitTestCanvasOverlay,
  snapPointToTargets,
} from '../../graphs/canvasOverlayGeometry';

describe('canvasOverlayGeometry', () => {
  it('draws open and closed polylines through the points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 0 },
    ];
    expect(canvasOverlayPolylinePath(points)).toBe('M 0 0 L 10 5 L 20 0');
    expect(canvasOverlayPolylinePath(points, true)).toBe('M 0 0 L 10 5 L 20 0 Z');
  });

  it('draws rects and ellipses from the same box', () => {
    expect(canvasOverlayRectPath(2, 3, 10, 20)).toBe('M 2 3 L 12 3 L 12 23 L 2 23 Z');
    expect(canvasOverlayEllipsePath(0, 0, 20, 10)).toBe(
      'M 0 5 A 10 5 0 1 0 20 5 A 10 5 0 1 0 0 5 Z',
    );
  });

  it('inscribes preset polygons in the dragged region', () => {
    const square = { x: 70, y: 70, width: 60, height: 60 };
    expect(canvasOverlayPresetPoints('triangle', square)).toHaveLength(3);
    expect(canvasOverlayPresetPoints('square', square)).toHaveLength(4);
    expect(canvasOverlayPresetPoints('hexagon', square)).toHaveLength(6);
    const star = canvasOverlayPresetPoints('star', square);
    expect(star).toHaveLength(10);
    // Alternating outer/inner arms around the center.
    const radii = star.map((point) => Math.hypot(point.x - 100, point.y - 100));
    for (const [index, radius] of radii.entries()) {
      expect(radius).toBeCloseTo(index % 2 === 0 ? 30 : 30 * 0.42, 8);
    }
    // The square sits axis-aligned (corners on the diagonals), the diamond points up.
    const [corner] = canvasOverlayPresetPoints('square', square);
    expect(Math.abs(corner.x - 100)).toBeCloseTo(Math.abs(corner.y - 100), 8);
    const [tip] = canvasOverlayPresetPoints('diamond', square);
    expect(tip.x).toBeCloseTo(100, 8);
    expect(tip.y).toBeCloseTo(70, 8);
    // Like an ellipse, the shape stretches with the region: the diamond tip touches
    // the top edge and the widest points touch the side edges.
    const wide = { x: 0, y: 0, width: 100, height: 40 };
    const [wideTip, wideRight] = canvasOverlayPresetPoints('diamond', wide);
    expect(wideTip.x).toBeCloseTo(50, 8);
    expect(wideTip.y).toBeCloseTo(0, 8);
    expect(wideRight.x).toBeCloseTo(100, 8);
    expect(wideRight.y).toBeCloseTo(20, 8);
  });

  it('hit-tests every kind and prefers the topmost overlay', () => {
    const line: CanvasOverlayType = {
      id: '03PQRSTV',
      kind: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    };
    const polygon: CanvasOverlayType = {
      id: '04WXYZ12',
      kind: 'polygon',
      points: [
        { x: 200, y: 200 },
        { x: 260, y: 200 },
        { x: 230, y: 250 },
      ],
    };
    const frame: CanvasOverlayType = {
      id: '05ABCDHJ',
      kind: 'frame',
      x: 300,
      y: 300,
      width: 60,
      height: 40,
    };
    expect(hitTestCanvasOverlay({ x: 50, y: 3 }, [line])).toEqual(line);
    expect(hitTestCanvasOverlay({ x: 50, y: 40 }, [line])).toBeNull();
    expect(hitTestCanvasOverlay({ x: 230, y: 215 }, [polygon])).toEqual(polygon);
    expect(hitTestCanvasOverlay({ x: 330, y: 320 }, [frame])).toEqual(frame);
    expect(hitTestCanvasOverlay({ x: 0, y: 500 }, [line, polygon, frame])).toBeNull();
    // Same spot, two overlays: the later document wins without zIndex, zIndex wins over order.
    const later: CanvasOverlayType = { ...frame, id: '07VWXYZ1' };
    expect(hitTestCanvasOverlay({ x: 330, y: 320 }, [frame, later])).toEqual(later);
    const under: CanvasOverlayType = { ...frame, id: '06KMPQRT', zIndex: 5 };
    expect(hitTestCanvasOverlay({ x: 330, y: 320 }, [under, frame])).toEqual(under);
    expect(hitTestCanvasOverlay({ x: 330, y: 320 }, [frame, under])).toEqual(under);
  });

  it('snaps inside the radius and leaves distant points alone', () => {
    const targets = [
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ];
    expect(snapPointToTargets({ x: 104, y: 103 }, targets, 8)).toEqual({ x: 100, y: 100 });
    expect(snapPointToTargets({ x: 150, y: 150 }, targets, 8)).toEqual({ x: 150, y: 150 });
  });

  it('points the arrowhead along the final segment', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const angle = canvasOverlayFinalAngle(points);
    expect(angle).toBeCloseTo(0, 10);
    const head = canvasOverlayArrowhead({ x: 10, y: 0 }, angle, 10);
    const [tip, left, right] = head.split(' ');
    expect(tip).toBe('10,0');
    // Both barbs sit behind the tip (smaller x), spread across the axis.
    for (const barb of [left, right]) {
      const [x, y] = barb.split(',').map(Number);
      expect(x).toBeLessThan(10);
      expect(Math.abs(y)).toBeGreaterThan(0);
    }
  });
});

import { deflate } from 'pako';
import { describe, expect, it } from 'vitest';
import {
  decodeSketchItems,
  encodeSketchItems,
  inflateSketchBytes,
  SketchCodecError,
} from '../../sketch/sketchCodec';
import { floodFillMask, maskToFillRings } from '../../sketch/sketchFill';
import {
  compactSketchItems,
  eraseStrokesAlongPath,
  hitTestSketchItems,
  rotateAboutMatrix,
  scaleAboutMatrix,
  selectItemsByLasso,
  simplifyFlatPoints,
  sketchItemBounds,
  sketchStrokePathData,
  transformSelectedItems,
  translateMatrix,
} from '../../sketch/sketchGeometry';
import type { SketchFill, SketchItem, SketchStroke } from '../../sketch/sketchTypes';

function stroke(points: number[], overrides: Partial<SketchStroke> = {}): SketchStroke {
  return {
    kind: 'stroke',
    brush: 'pen',
    color: '#112233',
    alpha: 1,
    size: 4,
    points,
    ...overrides,
  };
}

function line(x0: number, y0: number, x1: number, y1: number): SketchStroke {
  return stroke([x0, y0, x1, y1]);
}

describe('sketch codec', () => {
  it('round-trips strokes and fills at quarter-pixel resolution', () => {
    const items: SketchItem[] = [
      stroke([0, 0, 10.25, -3.5, 100, 200.75], {
        brush: 'marker',
        color: '#ff8800',
        alpha: 0.6,
        size: 12,
      }),
      stroke([5, 5]),
      {
        kind: 'fill',
        color: '#00ff00',
        alpha: 1,
        rings: [
          [0, 0, 100, 0, 100, 100, 0, 100],
          [25, 25, 75, 25, 75, 75],
        ],
      },
    ];
    const decoded = decodeSketchItems(encodeSketchItems(items));
    expect(decoded).toHaveLength(3);
    const first = decoded[0] as SketchStroke;
    expect(first.points).toEqual([0, 0, 10.25, -3.5, 100, 200.75]);
    expect(first.brush).toBe('marker');
    expect(first.color).toBe('#ff8800');
    expect(first.alpha).toBeCloseTo(0.6, 2);
    expect(first.size).toBe(12);
    expect((decoded[1] as SketchStroke).points).toEqual([5, 5]);
    expect((decoded[2] as SketchFill).rings).toEqual((items[2] as SketchFill).rings);
  });

  it('treats an empty layer as the empty string', () => {
    expect(encodeSketchItems([])).toBe('');
    expect(decodeSketchItems('')).toEqual([]);
  });

  it('stays small for a busy page', () => {
    const items: SketchItem[] = [];
    for (let index = 0; index < 2000; index += 1) {
      const points: number[] = [];
      for (let step = 0; step < 60; step += 1) {
        points.push(100 + index * 0.3 + step * 3.1, 200 + Math.sin(step / 5 + index) * 40);
      }
      items.push(stroke(points));
    }
    const encoded = encodeSketchItems(items);
    expect(encoded.length).toBeLessThan(900_000);
    expect(decodeSketchItems(encoded)).toHaveLength(2000);
  });

  it('rejects garbage and truncated data', () => {
    expect(() => decodeSketchItems('not base64!')).toThrow(SketchCodecError);
    const good = encodeSketchItems([line(0, 0, 10, 10)]);
    expect(() => decodeSketchItems(good.slice(0, 8))).toThrow(SketchCodecError);
  });

  it('refuses to inflate past the ceiling (decompression bomb)', () => {
    const bomb = deflate(new Uint8Array(4 * 1024 * 1024));
    expect(bomb.length).toBeLessThan(10_000);
    expect(() => inflateSketchBytes(bomb, 1024 * 1024)).toThrow(SketchCodecError);
  });
});

describe('sketch geometry', () => {
  it('draws a dot for a single point and a smoothed curve for many', () => {
    expect(sketchStrokePathData([10, 10])).toBe('M10 10L10.01 10');
    expect(sketchStrokePathData([0, 0, 10, 10])).toBe('M0 0L10 10');
    expect(sketchStrokePathData([0, 0, 10, 0, 20, 10])).toMatch(/^M0 0L5 0Q10 0 15 5L20 10$/);
  });

  it('keeps sharp corners sharp and smooths only gentle bends', () => {
    // A box corner (90 degrees) is a corner the pen meant: no rounding.
    expect(sketchStrokePathData([0, 0, 100, 0, 100, 100])).toBe('M0 0L100 0L100 100');
    // A closed rectangle keeps all four corners.
    expect(sketchStrokePathData([0, 0, 50, 0, 50, 30, 0, 30, 0, 0])).toBe(
      'M0 0L50 0L50 30L0 30L0 0',
    );
    // A 30 degree bend is a curve: smoothed, and consecutive bends share their midpoints.
    const gentle = sketchStrokePathData([0, 0, 10, 0, 20, 6, 30, 18, 40, 18]);
    expect(gentle).toContain('Q');
    expect((gentle.match(/L/g) ?? []).length).toBe(2);
    // After a corner the next bend starts from the middle of its incoming segment.
    expect(sketchStrokePathData([0, 0, 100, 0, 100, 10, 110, 20, 120, 40])).toBe(
      'M0 0L100 0L100 5Q100 10 105 15Q110 20 115 30L120 40',
    );
  });

  it('simplifies collinear points but keeps the corners', () => {
    expect(simplifyFlatPoints([0, 0, 5, 0, 10, 0, 10, 10], 0.3)).toEqual([0, 0, 10, 0, 10, 10]);
  });

  it('computes bounds including half the stroke width', () => {
    const bounds = sketchItemBounds(stroke([10, 10, 30, 20], { size: 4 }));
    expect(bounds).toEqual({ x: 8, y: 8, width: 24, height: 14 });
  });

  describe('eraser', () => {
    it('cuts a stroke in two around the eraser', () => {
      const original = line(0, 0, 100, 0);
      const { items, changed } = eraseStrokesAlongPath([original], [50, 0], 10);
      expect(changed).toBe(true);
      expect(items).toHaveLength(2);
      const [left, right] = items as SketchStroke[];
      expect(left.points[left.points.length - 2]).toBeLessThanOrEqual(41);
      expect(left.points[left.points.length - 2]).toBeGreaterThan(35);
      expect(right.points[0]).toBeGreaterThanOrEqual(59);
      expect(right.points[0]).toBeLessThan(65);
    });

    it('removes a stroke the eraser fully covers', () => {
      const { items } = eraseStrokesAlongPath([line(0, 0, 10, 0)], [5, 0, 5, 1], 20);
      expect(items).toHaveLength(0);
    });

    it('leaves untouched strokes as the same references', () => {
      const far = line(500, 500, 600, 500);
      const near = line(0, 0, 100, 0);
      const { items } = eraseStrokesAlongPath([far, near], [50, 0], 5);
      expect(items[0]).toBe(far);
    });

    it('reports no change without allocating', () => {
      const source: SketchItem[] = [line(0, 0, 100, 0)];
      const result = eraseStrokesAlongPath(source, [50, 80], 5);
      expect(result.changed).toBe(false);
      expect(result.items).toBe(source);
    });

    it('leaves fills to the fill eraser: dragging over one changes no stroke list entry', () => {
      const fill: SketchFill = {
        kind: 'fill',
        color: '#ff0000',
        alpha: 1,
        rings: [[0, 0, 100, 0, 100, 100, 0, 100]],
      };
      expect(eraseStrokesAlongPath([fill], [50, 50, 60, 60], 20).changed).toBe(false);
    });
  });

  describe('hit test', () => {
    it('finds the topmost item and respects stroke width', () => {
      const under = stroke([0, 0, 100, 0], { size: 10 });
      const over = stroke([0, 0, 100, 0], { size: 2 });
      expect(hitTestSketchItems([under, over], 50, 4, 0)).toBe(0);
      expect(hitTestSketchItems([under, over], 50, 4, 0)).not.toBe(1);
      expect(hitTestSketchItems([under, over], 50, 30, 2)).toBe(-1);
    });
  });

  describe('lasso', () => {
    const box = [10, -50, 90, -50, 90, 50, 10, 50];
    it('picks whole strokes that are mostly inside', () => {
      const inside = line(20, 0, 80, 0);
      const mostly = line(60, 10, 140, 10);
      const outside = line(200, 0, 300, 0);
      const { items, selected } = selectItemsByLasso([inside, mostly, outside], box, 'whole');
      expect(items).toHaveLength(3);
      expect(selected).toContain(inside);
      expect(selected).not.toContain(outside);
    });

    it('cuts a crossing stroke along the border', () => {
      const crossing = line(0, 0, 100, 0);
      const { items, selected } = selectItemsByLasso([crossing], box, 'cut');
      expect(items.length).toBe(3);
      expect(selected).toHaveLength(1);
      const piece = selected[0] as SketchStroke;
      expect(piece.points[0]).toBeGreaterThanOrEqual(8);
      expect(piece.points[piece.points.length - 2]).toBeLessThanOrEqual(92);
    });

    it('ignores a degenerate lasso', () => {
      expect(selectItemsByLasso([line(0, 0, 10, 0)], [0, 0, 5, 5], 'whole').selected).toEqual([]);
    });
  });

  describe('transform', () => {
    it('moves only the selection and keeps z-order', () => {
      const a = line(0, 0, 10, 0);
      const b = line(0, 10, 10, 10);
      const c = line(0, 20, 10, 20);
      const { items, selected } = transformSelectedItems(
        [a, b, c],
        new Set([b]),
        translateMatrix(5, 7),
      );
      expect(items[0]).toBe(a);
      expect(items[2]).toBe(c);
      expect((items[1] as SketchStroke).points).toEqual([5, 17, 15, 17]);
      expect(selected).toEqual([items[1]]);
    });

    it('scales stroke width with the transform', () => {
      const original = stroke([0, 0, 10, 0], { size: 4 });
      const { items } = transformSelectedItems(
        [original],
        new Set([original]),
        scaleAboutMatrix(2, 2, 0, 0),
      );
      expect((items[0] as SketchStroke).size).toBe(8);
    });

    it('rotates a quarter turn about a point', () => {
      const original = line(10, 0, 20, 0);
      const { items } = transformSelectedItems(
        [original],
        new Set([original]),
        rotateAboutMatrix(Math.PI / 2, 0, 0),
      );
      const [x0, y0, x1, y1] = (items[0] as SketchStroke).points;
      expect(x0).toBeCloseTo(0);
      expect(y0).toBeCloseTo(10);
      expect(x1).toBeCloseTo(0);
      expect(y1).toBeCloseTo(20);
    });
  });

  it('compacts degenerate items and is idempotent', () => {
    const noisy = stroke([0, 0, 0, 0, 1, 0, 2, 0, 3, 0, 10, 0]);
    const empty = stroke([4, 4, 4, 4]);
    const compacted = compactSketchItems([noisy, empty]);
    // `empty` collapses to a single point, which is still a dot.
    expect(compacted).toHaveLength(2);
    expect((compacted[1] as SketchStroke).points).toEqual([4, 4]);
    expect((compacted[0] as SketchStroke).points).toEqual([0, 0, 10, 0]);
    expect(compactSketchItems(compacted)).toEqual(compacted);
  });
});

describe('flood fill', () => {
  /** A white `size` square with a black frame `thickness` wide, as RGBA. */
  function framedBuffer(size: number, thickness: number) {
    const data = new Uint8Array(size * size * 4).fill(255);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const onFrame =
          x < thickness || y < thickness || x >= size - thickness || y >= size - thickness;
        if (onFrame) {
          const offset = (y * size + x) * 4;
          data[offset] = 0;
          data[offset + 1] = 0;
          data[offset + 2] = 0;
        }
      }
    }
    return { data, width: size, height: size };
  }

  it('fills the interior and stops at the frame', () => {
    const fill = floodFillMask(framedBuffer(40, 3), 20, 20, 32);
    expect(fill).not.toBeNull();
    expect(fill?.count).toBe(34 * 34);
  });

  it('leaks through a gap in the outline', () => {
    const buffer = framedBuffer(40, 3);
    for (let y = 0; y < 3; y += 1) {
      for (let x = 15; x < 20; x += 1) {
        const offset = (y * 40 + x) * 4;
        buffer.data[offset] = 255;
        buffer.data[offset + 1] = 255;
        buffer.data[offset + 2] = 255;
      }
    }
    const fill = floodFillMask(buffer, 20, 20, 32);
    expect(fill?.count).toBeGreaterThan(34 * 34);
  });

  /** A 100x100 page with a hand-drawn-style ring (radius 30, 3px thick) and an opening at its top. */
  function openRing(openingWidth: number) {
    const size = 100;
    const data = new Uint8Array(size * size * 4).fill(255);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const distance = Math.hypot(x - 50, y - 50);
        const onRing = Math.abs(distance - 30) <= 1.5;
        const inOpening = openingWidth > 0 && y < 50 && Math.abs(x - 50) <= openingWidth / 2;
        if (onRing && !inOpening) {
          const offset = (y * size + x) * 4;
          data[offset] = data[offset + 1] = data[offset + 2] = 0;
        }
      }
    }
    return { data, width: size, height: size };
  }

  it('leaks through an opening in the ring, and reports it by touching the page edge', () => {
    const leaked = floodFillMask(openRing(6), 50, 50, 40);
    expect(leaked?.touchesEdge).toBe(true);
    expect(leaked?.count).toBeGreaterThan(5000);
  });

  it('closes an opening up to the gap size and stays inside the ring', () => {
    const closed = floodFillMask(openRing(6), 50, 50, 40, 5);
    expect(closed?.touchesEdge).toBe(false);
    // The inside of a radius-30 ring is about 2800 pixels; the page is 10000.
    expect(closed?.count).toBeGreaterThan(2400);
    expect(closed?.count).toBeLessThan(3400);
  });

  it('cannot close an opening wider than the gap', () => {
    expect(floodFillMask(openRing(14), 50, 50, 40, 3)?.touchesEdge).toBe(true);
  });

  it('falls back to the exact fill when the seed sits on a line', () => {
    const onLine = floodFillMask(openRing(0), 50, 20, 40, 5);
    expect(onLine).not.toBeNull();
    // Exact fill of the black ring itself, not the page.
    expect(onLine?.count).toBeLessThan(1200);
  });

  it('keeps gap closing identical for a closed shape', () => {
    const exact = floodFillMask(openRing(0), 50, 50, 40, 0);
    const withGap = floodFillMask(openRing(0), 50, 50, 40, 4);
    expect(withGap?.count).toBe(exact?.count);
  });

  it('returns null outside the buffer', () => {
    expect(floodFillMask(framedBuffer(10, 1), -1, 5, 10)).toBeNull();
    expect(floodFillMask(framedBuffer(10, 1), 5, 99, 10)).toBeNull();
  });

  it('traces a square into one ring and a ring-shaped region into outer + hole', () => {
    const square = floodFillMask(framedBuffer(40, 3), 20, 20, 32);
    if (!square) throw new Error('expected a region');
    const rings = maskToFillRings(square, {
      scale: 1,
      originX: 100,
      originY: 200,
      dilate: 0,
      epsilon: 0.5,
    });
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(8);
    const xs = rings[0].filter((_, index) => index % 2 === 0);
    const ys = rings[0].filter((_, index) => index % 2 === 1);
    expect(Math.min(...xs)).toBe(103);
    expect(Math.max(...xs)).toBe(137);
    expect(Math.min(...ys)).toBe(203);

    const frame = floodFillMask(framedBuffer(40, 3), 1, 1, 32);
    if (!frame) throw new Error('expected the frame region');
    const frameRings = maskToFillRings(frame, {
      scale: 1,
      originX: 0,
      originY: 0,
      dilate: 0,
      epsilon: 0.5,
    });
    expect(frameRings).toHaveLength(2);
  });

  it('dilation tucks the fill under the outline', () => {
    const square = floodFillMask(framedBuffer(40, 3), 20, 20, 32);
    if (!square) throw new Error('expected a region');
    const rings = maskToFillRings(square, {
      scale: 1,
      originX: 0,
      originY: 0,
      dilate: 2,
      epsilon: 0.5,
    });
    const xs = rings[0].filter((_, index) => index % 2 === 0);
    expect(Math.min(...xs)).toBe(1);
    expect(Math.max(...xs)).toBe(39);
  });
});

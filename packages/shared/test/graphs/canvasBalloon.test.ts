import { describe, expect, it } from 'vitest';
import {
  balloonContains,
  balloonEllipsePoint,
  balloonPath,
  balloonTailAxis,
  balloonTailBase,
  balloonTailPolygon,
  balloonText,
  clampBalloonTip,
  defaultBalloonTail,
} from '../../graphs/canvasBalloon';
import { hitTestCanvasOverlay } from '../../graphs/canvasOverlayGeometry';
import type { CanvasOverlayType } from '../../schemas/CanvasOverlaySchemas';

const rect = { x: 100, y: 100, width: 200, height: 100 };
const center = { x: 200, y: 150 };

describe('balloon tail axis', () => {
  it('picks the nearest of eight axes around the ellipse center', () => {
    const at = (dx: number, dy: number) =>
      balloonTailAxis(rect, { x: center.x + dx, y: center.y + dy });
    expect(at(300, 0)).toBe(0); // east
    expect(at(200, 100)).toBe(1); // south-east (equal in ellipse radii)
    expect(at(0, 300)).toBe(2); // south
    expect(at(-200, 100)).toBe(3);
    expect(at(-300, 0)).toBe(4); // west
    expect(at(-200, -100)).toBe(5);
    expect(at(0, -300)).toBe(6); // north
    expect(at(200, -100)).toBe(7);
  });

  it('follows the ellipse, not the page: a wide balloon points diagonally sooner', () => {
    // About 20 degrees below east on the page is 36 in ellipse space for a 2:1 balloon: south-east.
    expect(balloonTailAxis(rect, { x: center.x + 200, y: center.y + 73 })).toBe(1);
  });

  it('keeps the base on the ellipse outline', () => {
    for (let axis = 0; axis < 8; axis += 1) {
      for (const point of balloonTailBase(rect, axis)) {
        const nx = (point.x - center.x) / 100;
        const ny = (point.y - center.y) / 50;
        expect(Math.hypot(nx, ny)).toBeCloseTo(1, 5);
      }
    }
  });
});

describe('balloon tip', () => {
  it('pushes a tip that sits inside the ellipse out to a visible tail', () => {
    const clamped = clampBalloonTip(rect, { x: center.x + 10, y: center.y + 5 });
    const radius = Math.hypot((clamped.x - center.x) / 100, (clamped.y - center.y) / 50);
    expect(radius).toBeCloseTo(1.25, 5);
    const dead = clampBalloonTip(rect, center);
    expect(dead.x).toBeGreaterThan(center.x);
    expect(dead.y).toBeGreaterThan(center.y);
  });

  it('leaves a clear tip alone and defaults to the south-east axis', () => {
    const tip = { x: 400, y: 300 };
    expect(clampBalloonTip(rect, tip)).toBe(tip);
    const fresh = defaultBalloonTail(rect);
    expect(balloonTailAxis(rect, fresh)).toBe(1);
    expect(fresh.x).toBeGreaterThan(balloonEllipsePoint(rect, Math.PI / 4).x);
  });
});

describe('balloon outline and text', () => {
  it('is one closed path with an arc for the body and a line out to the tip', () => {
    const d = balloonPath(rect, { x: 330, y: 240 });
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('A100 50 0 1 1');
    expect(d).toContain('L330 240');
    expect(d.endsWith('Z')).toBe(true);
    expect((d.match(/M/g) ?? []).length).toBe(1);
  });

  it('wraps and vertically centers the words inside the ellipse', () => {
    const one = balloonText({ ...rect, content: 'Hi' });
    expect(one.lines).toEqual(['Hi']);
    expect(one.top + one.lineHeight / 2).toBeCloseTo(150, 5);
    const many = balloonText({
      ...rect,
      content: 'a long sentence that has to wrap across several lines',
      fontSize: 20,
    });
    expect(many.lines.length).toBeGreaterThan(2);
    expect(many.fontSize).toBe(20);
    expect(many.top + (many.lines.length * many.lineHeight) / 2).toBeCloseTo(150, 5);
  });
});

describe('balloon hit test', () => {
  const tip = { x: 330, y: 240 };
  it('hits the body, the tail and nothing around them', () => {
    expect(balloonContains(rect, tip, center, 0)).toBe(true);
    expect(balloonContains(rect, tip, { x: 105, y: 105 }, 0)).toBe(false); // box corner, outside the ellipse
    const [before, , after] = balloonTailPolygon(rect, tip);
    const inTail = {
      x: (before.x + after.x + tip.x * 2) / 4,
      y: (before.y + after.y + tip.y * 2) / 4,
    };
    expect(balloonContains(rect, tip, inTail, 0)).toBe(true);
    expect(balloonContains(rect, tip, { x: 330, y: 330 }, 4)).toBe(false);
  });

  it('is reachable through the shared overlay hit test', () => {
    const balloon: CanvasOverlayType = {
      id: '01ABCDEF',
      kind: 'balloon',
      ...rect,
      tail: tip,
      content: '',
    };
    expect(hitTestCanvasOverlay(center, [balloon], 4)?.id).toBe('01ABCDEF');
    expect(hitTestCanvasOverlay({ x: 900, y: 900 }, [balloon], 4)).toBeNull();
  });
});

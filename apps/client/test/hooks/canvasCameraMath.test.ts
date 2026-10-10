/**
 * @jest-environment node
 */
import {
  MAX_FOCUS_SCALE,
  transformCenteredOn,
  transformFittingRect,
  wheelZoomFactor,
} from '../../src/hooks/canvasCameraMath';

const VIEWPORT = { width: 400, height: 300 };
const LIMITS = { minScale: 0.15, maxScale: 2.5 };

describe('wheelZoomFactor', () => {
  it('zooms in for a wheel turned away and out for one turned towards the user', () => {
    expect(wheelZoomFactor(-100, 0)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100, 0)).toBeLessThan(1);
    expect(wheelZoomFactor(0, 0)).toBe(1);
  });

  it('undoes itself with an opposite turn of the same size', () => {
    expect(wheelZoomFactor(-80, 0) * wheelZoomFactor(80, 0)).toBeCloseTo(1, 10);
  });

  it('reads lines and pages as more pixels than pixels', () => {
    expect(wheelZoomFactor(-3, 1)).toBeCloseTo(wheelZoomFactor(-48, 0), 10);
    expect(wheelZoomFactor(-1, 2)).toBeCloseTo(wheelZoomFactor(-300, 0), 10);
  });

  it('does not let a free-spinning wheel throw the camera across the map', () => {
    expect(wheelZoomFactor(-100000, 0)).toBeCloseTo(wheelZoomFactor(-300, 0), 10);
    expect(wheelZoomFactor(100000, 0)).toBeCloseTo(wheelZoomFactor(300, 0), 10);
  });
});

describe('transformCenteredOn', () => {
  it('maps the point to the middle of the viewport', () => {
    const { scale, x, y } = transformCenteredOn({ x: 100, y: 50 }, 2, VIEWPORT);

    expect(100 * scale + x).toBe(VIEWPORT.width / 2);
    expect(50 * scale + y).toBe(VIEWPORT.height / 2);
  });
});

describe('transformFittingRect', () => {
  it('shows a large rect whole, with the usual margin', () => {
    const { scale } = transformFittingRect(
      { x: 0, y: 0, width: 1000, height: 600 },
      VIEWPORT,
      LIMITS,
    );

    expect(scale).toBeCloseTo(0.4 * 0.94, 6);
  });

  it('centres a small rect without magnifying it past a readable size', () => {
    const { scale, x, y } = transformFittingRect(
      { x: 300, y: 200, width: 112, height: 44 },
      VIEWPORT,
      LIMITS,
    );

    expect(scale).toBe(MAX_FOCUS_SCALE);
    expect(356 * scale + x).toBeCloseTo(VIEWPORT.width / 2, 6);
    expect(222 * scale + y).toBeCloseTo(VIEWPORT.height / 2, 6);
  });

  it('treats a single point as a rect of no size', () => {
    expect(
      transformFittingRect({ x: 10, y: 10, width: 0, height: 0 }, VIEWPORT, LIMITS).scale,
    ).toBe(MAX_FOCUS_SCALE);
  });

  it('keeps inside the limits of the canvas', () => {
    expect(
      transformFittingRect({ x: 0, y: 0, width: 100000, height: 100000 }, VIEWPORT, LIMITS).scale,
    ).toBe(LIMITS.minScale);
    expect(
      transformFittingRect({ x: 0, y: 0, width: 1, height: 1 }, VIEWPORT, {
        minScale: 0.1,
        maxScale: 0.5,
      }).scale,
    ).toBe(0.5);
  });
});

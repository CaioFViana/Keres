/**
 * @jest-environment node
 */
import { act, renderHook } from '@testing-library/react-native';
import { createRef } from 'react';
import {
  useCanvasViewport,
  type CanvasViewportBounds,
  type CanvasViewportHandle,
  type CanvasViewportOptions,
} from '../../src/hooks/useCanvasViewport';

const VIEWPORT = { x: 0, y: 0, width: 400, height: 300 };
const BOUNDS = { x: 0, y: 0, width: 800, height: 600 };

function scaleOf(current: ReturnType<typeof useCanvasViewport>) {
  const [, , { scale }] = current.animatedTransform as any[];
  return (scale as any)._value as number;
}

async function renderCanvas(
  layout: CanvasViewportBounds = BOUNDS,
  options: CanvasViewportOptions = { clampMode: 'none' },
  sized = true,
) {
  const ref = createRef<CanvasViewportHandle>();
  const view = await renderHook(() => useCanvasViewport(ref, layout, options));
  if (sized) {
    (view.result.current.containerRef as any).current = {
      measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
        cb(VIEWPORT.x, VIEWPORT.y, VIEWPORT.width, VIEWPORT.height),
    };
    await act(async () => {
      view.result.current.handleLayout();
    });
  }
  return { ...view, ref };
}

describe('looking at part of the drawing on demand', () => {
  it('puts the asked point in the middle of the viewport, keeping the zoom', async () => {
    const { result, ref } = await renderCanvas();
    const before = scaleOf(result.current);

    await act(async () => {
      ref.current!.centerOn({ x: 120, y: 90 });
    });

    expect(scaleOf(result.current)).toBeCloseTo(before, 6);
    const centre = ref.current!.viewportWorldCenter();
    expect(centre.x).toBeCloseTo(120, 3);
    expect(centre.y).toBeCloseTo(90, 3);
  });

  it('can change the zoom while centring, inside the limits', async () => {
    const { result, ref } = await renderCanvas(BOUNDS, { clampMode: 'none', maxScale: 2 });

    await act(async () => {
      ref.current!.centerOn({ x: 10, y: 10 }, 5);
    });

    expect(scaleOf(result.current)).toBe(2);
  });

  it('frames a part of the drawing whole', async () => {
    const { result, ref } = await renderCanvas();
    const rect = { x: 100, y: 100, width: 200, height: 100 };

    await act(async () => {
      ref.current!.fitToRect(rect);
    });

    const scale = scaleOf(result.current);
    const centre = ref.current!.viewportWorldCenter();
    // Half of the rect, at this zoom, fits on each side of the middle of the viewport.
    expect((rect.width / 2) * scale).toBeLessThanOrEqual(VIEWPORT.width / 2);
    expect((rect.height / 2) * scale).toBeLessThanOrEqual(VIEWPORT.height / 2);
    expect(centre.x).toBeCloseTo(200, 3);
    expect(centre.y).toBeCloseTo(150, 3);
  });

  it('centres a single small node instead of magnifying it', async () => {
    const { result, ref } = await renderCanvas();

    await act(async () => {
      ref.current!.fitToRect({ x: 300, y: 200, width: 112, height: 44 });
    });

    expect(scaleOf(result.current)).toBeLessThanOrEqual(1.2);
    expect(ref.current!.viewportWorldCenter().x).toBeCloseTo(356, 3);
  });

  it('does nothing while the viewport has no size yet', async () => {
    const { result, ref } = await renderCanvas(BOUNDS, { clampMode: 'none' }, false);
    const before = scaleOf(result.current);

    await act(async () => {
      ref.current!.centerOn({ x: 5, y: 5 });
      ref.current!.fitToRect({ x: 0, y: 0, width: 10, height: 10 });
    });

    expect(scaleOf(result.current)).toBe(before);
  });
});

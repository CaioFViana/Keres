/**
 * @jest-environment node
 */
import { act, renderHook } from '@testing-library/react-native';
import { createRef } from 'react';
import { MAX_SPATIAL_NATIVE_SURFACE } from '@keres/shared';
import {
  useFreeformCanvasViewport,
  type FreeformCanvasHandle,
} from '../../src/hooks/useFreeformCanvasViewport';

const VIEWPORT = { x: 0, y: 0, width: 400, height: 300 };
const BOUNDS = { x: 0, y: 0, width: 800, height: 600 };

async function renderViewport(
  bounds: { x: number; y: number; width: number; height: number } | null = BOUNDS,
  viewport = VIEWPORT,
) {
  const ref = createRef<FreeformCanvasHandle>();
  const view = await renderHook(() => useFreeformCanvasViewport(ref, { bounds }));
  (view.result.current.containerRef as { current: unknown }).current = {
    measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
      callback(viewport.x, viewport.y, viewport.width, viewport.height),
  };
  await act(async () => {
    view.result.current.handleLayout();
  });
  return { ...view, ref };
}

describe('useFreeformCanvasViewport', () => {
  it('allocates a native surface from the device viewport, not a world-sized square', async () => {
    const { result } = await renderViewport();

    expect(result.current.width).toBe(1200);
    expect(result.current.height).toBe(900);
    expect(result.current.width).toBeLessThanOrEqual(MAX_SPATIAL_NATIVE_SURFACE);
    expect(result.current.height).toBeLessThanOrEqual(MAX_SPATIAL_NATIVE_SURFACE);
  });

  it('keeps the native surface bounded even when the document is enormous', async () => {
    const { result } = await renderViewport({
      x: -50_000,
      y: -50_000,
      width: 100_000,
      height: 100_000,
    });

    expect(result.current.width).toBe(1200);
    expect(result.current.height).toBe(900);
  });

  it('exposes the world point currently at the centre of the viewport', async () => {
    const { result, ref } = await renderViewport();
    const center = ref.current?.viewportWorldCenter();
    expect(center?.x).toBeCloseTo(BOUNDS.x + BOUNDS.width / 2, 1);
    expect(center?.y).toBeCloseTo(BOUNDS.y + BOUNDS.height / 2, 1);
    expect(result.current.bakedScale).toBeGreaterThan(0);
  });
});

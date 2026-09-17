/**
 * @jest-environment node
 */
import { act, renderHook } from '@testing-library/react-native';
import { createRef } from 'react';
import { PanResponder } from 'react-native';
import { MAX_SPATIAL_NATIVE_SURFACE, spatialRenderWindow } from '@keres/shared';
import {
  useCanvasViewport,
  type CanvasViewportBounds,
  type CanvasViewportHandle,
  type CanvasViewportOptions,
} from '../../src/hooks/useCanvasViewport';

const LAYOUT = { width: 1000, height: 800 };
const VIEWPORT = { x: 0, y: 0, width: 400, height: 300 };
const BOUNDS = { x: 0, y: 0, width: 800, height: 600 };

/** Valor atual de cada `Animated.Value` do transform devolvido pelo hook. */
function transformOf(current: ReturnType<typeof useCanvasViewport>) {
  const [{ translateX }, { translateY }, { scale }] = current.animatedTransform as any[];
  return {
    x: (translateX as any)._value as number,
    y: (translateY as any)._value as number,
    scale: (scale as any)._value as number,
  };
}

/**
 * Mounts the hook and simulates the `onLayout`, which is the moment the window gains a size -
 * before that the hook has no way to frame anything.
 */
async function renderCanvas(
  layout: CanvasViewportBounds = LAYOUT,
  viewport = VIEWPORT,
  options: CanvasViewportOptions = {},
) {
  const ref = createRef<CanvasViewportHandle>();
  const view = await renderHook(() => useCanvasViewport(ref, layout, options));

  (view.result.current.containerRef as any).current = {
    measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
      callback(viewport.x, viewport.y, viewport.width, viewport.height),
  };
  await act(async () => {
    view.result.current.handleLayout();
  });

  return { ...view, ref };
}

describe('fitting on layout', () => {
  it('scales the drawing down to fit the viewport', async () => {
    const { result } = await renderCanvas();

    // 400/1000 = 0.4 e 300/800 = 0.375; vence o menor, com a folga de 6%.
    expect(transformOf(result.current).scale).toBeCloseTo(0.375 * 0.94, 4);
  });

  it('centres the drawing inside the viewport', async () => {
    const { result } = await renderCanvas();

    const { x, y, scale } = transformOf(result.current);
    expect(x).toBeCloseTo((VIEWPORT.width - LAYOUT.width * scale) / 2, 3);
    expect(y).toBeCloseTo((VIEWPORT.height - LAYOUT.height * scale) / 2, 3);
  });

  /**
   * The timeline frames by height and remains wider than the window. Centring
   * cut both sides off - and on the left are the scene names, which are the only thing that says
   * which scene each bar belongs to.
   */
  it('starts at the beginning of a drawing wider than the viewport', async () => {
    const { result } = await renderCanvas({ width: 4000, height: 300 }, VIEWPORT, {
      fitMode: 'height',
      fitVerticalAlignment: 'top',
    });

    const { x, y } = transformOf(result.current);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it('does not zoom past the configured maximum for a tiny drawing', async () => {
    const { result } = await renderCanvas({ width: 10, height: 10 }, VIEWPORT, { maxScale: 2 });

    expect(transformOf(result.current).scale).toBe(2);
  });

  it('does not zoom below the configured minimum for a huge drawing', async () => {
    const { result } = await renderCanvas({ width: 100000, height: 100000 }, VIEWPORT, {
      minScale: 0.2,
    });

    expect(transformOf(result.current).scale).toBe(0.2);
  });

  it('does nothing while the viewport has no size yet', async () => {
    const { result } = await renderCanvas(LAYOUT, { x: 0, y: 0, width: 0, height: 0 });

    expect(transformOf(result.current)).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it('does nothing for an empty drawing', async () => {
    const { result } = await renderCanvas({ width: 0, height: 0 });

    expect(transformOf(result.current)).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it('does not re-fit on a repeated layout of the same drawing', async () => {
    const { result } = await renderCanvas();
    const fitted = transformOf(result.current);

    result.current.containerRef.current!.measureInWindow = ((callback: any) =>
      callback(0, 0, 900, 900)) as never;
    await act(async () => {
      result.current.handleLayout();
    });

    expect(transformOf(result.current)).toEqual(fitted);
  });

  it('leaves the camera untouched when the document frame shifts under it', async () => {
    // Boards recompute their bounds - including a negative origin - on every drag. Children are
    // world-addressed, so a frame shift moves nothing on screen and the camera must not
    // compensate for it. (The previous viewport translated the pan here because children were
    // positioned against the document frame; that coupling was the teleport mechanism.)
    const ref = createRef<CanvasViewportHandle>();
    let bounds = { ...BOUNDS };
    const view = await renderHook(() =>
      useCanvasViewport(ref, bounds, { clampMode: 'none', refitOnLayoutChange: false }),
    );
    (view.result.current.containerRef as any).current = {
      measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
        callback(VIEWPORT.x, VIEWPORT.y, VIEWPORT.width, VIEWPORT.height),
    };
    await act(async () => {
      view.result.current.handleLayout();
    });
    const before = transformOf(view.result.current);
    const overlayBefore = view.result.current.renderWindow;

    bounds = { x: -240, y: -240, width: 1240, height: 1040 };
    await view.rerender(undefined as never);

    expect(transformOf(view.result.current)).toEqual(before);
    expect(view.result.current.renderWindow).toBe(overlayBefore);
  });
});

describe('the handle exposed to the screen', () => {
  it('re-fits on demand', async () => {
    const { result, ref } = await renderCanvas();
    await act(async () => {
      ref.current!.zoomBy(2);
    });

    await act(async () => {
      ref.current!.fitToScreen();
    });

    expect(transformOf(result.current).scale).toBeCloseTo(0.375 * 0.94, 4);
  });

  it('zooms in around the centre of the viewport', async () => {
    const { result, ref } = await renderCanvas();
    const before = transformOf(result.current);

    await act(async () => {
      ref.current!.zoomBy(2);
    });

    expect(transformOf(result.current).scale).toBeCloseTo(before.scale * 2, 4);
  });

  it('zooms out too', async () => {
    const { result, ref } = await renderCanvas();
    const before = transformOf(result.current);

    await act(async () => {
      ref.current!.zoomBy(0.5);
    });

    expect(transformOf(result.current).scale).toBeCloseTo(before.scale * 0.5, 4);
  });

  it('never zooms past the maximum', async () => {
    const { result, ref } = await renderCanvas(LAYOUT, VIEWPORT, { maxScale: 2 });

    await act(async () => {
      ref.current!.zoomBy(100);
    });

    expect(transformOf(result.current).scale).toBe(2);
  });

  it('never zooms below the minimum', async () => {
    const { result, ref } = await renderCanvas(LAYOUT, VIEWPORT, { minScale: 0.15 });

    await act(async () => {
      ref.current!.zoomBy(0.001);
    });

    expect(transformOf(result.current).scale).toBe(0.15);
  });

  it('exposes the world point currently at the centre of the viewport', async () => {
    const { result, ref } = await renderCanvas(BOUNDS, VIEWPORT, { clampMode: 'none' });

    const center = ref.current?.viewportWorldCenter();
    expect(center?.x).toBeCloseTo(BOUNDS.x + BOUNDS.width / 2, 1);
    expect(center?.y).toBeCloseTo(BOUNDS.y + BOUNDS.height / 2, 1);
    expect(result.current.scale).toBeGreaterThan(0);
  });
});

/**
 * The rule that stops the user from "losing" the graph: while the drawing fits in the window it
 * stays centred, and when it is bigger it cannot be dragged out of sight.
 */
describe('keeping the drawing reachable', () => {
  it('centres a drawing smaller than the viewport, whatever the zoom', async () => {
    const { result, ref } = await renderCanvas({ width: 100, height: 100 }, VIEWPORT, {
      maxScale: 1,
    });

    await act(async () => {
      ref.current!.zoomBy(0.5);
    });

    const { x, y, scale } = transformOf(result.current);
    expect(x).toBeCloseTo((VIEWPORT.width - 100 * scale) / 2, 3);
    expect(y).toBeCloseTo((VIEWPORT.height - 100 * scale) / 2, 3);
  });

  it('never leaves a gap on the left or top of a drawing larger than the viewport', async () => {
    const { result, ref } = await renderCanvas();

    await act(async () => {
      ref.current!.zoomBy(4);
    });

    const { x, y } = transformOf(result.current);
    expect(x).toBeLessThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(0);
  });

  it('never leaves a gap on the right or bottom either', async () => {
    const { result, ref } = await renderCanvas();

    await act(async () => {
      ref.current!.zoomBy(4);
    });

    const { x, y, scale } = transformOf(result.current);
    expect(x).toBeGreaterThanOrEqual(VIEWPORT.width - LAYOUT.width * scale);
    expect(y).toBeGreaterThanOrEqual(VIEWPORT.height - LAYOUT.height * scale);
  });
});

/**
 * The gesture decisions are asserted on the config handed to `PanResponder`, and not on
 * the ready-made `panHandlers`: those are wrapped by React Native, which does its own
 * touch bookkeeping before delegating, and feeding them would mean forging a complete native
 * event without gaining anything in confidence.
 */
describe('gesture decisions', () => {
  const configOf = async () => {
    const create = jest.spyOn(PanResponder, 'create');
    await renderCanvas();
    return create.mock.calls.at(-1)![0] as any;
  };

  afterEach(() => jest.restoreAllMocks());

  it('lets a plain tap through, so tapping a node opens it', async () => {
    const config = await configOf();

    expect(config.onStartShouldSetPanResponderCapture()).toBe(false);
  });

  it('ignores a movement too small to be a drag', async () => {
    const config = await configOf();

    expect(
      config.onMoveShouldSetPanResponderCapture(
        { nativeEvent: { touches: [{}] } },
        { dx: 1, dy: 1 },
      ),
    ).toBe(false);
  });

  it('takes over once the finger moves past the drag threshold', async () => {
    const config = await configOf();

    expect(
      config.onMoveShouldSetPanResponderCapture(
        { nativeEvent: { touches: [{}] } },
        { dx: 20, dy: 0 },
      ),
    ).toBe(true);
  });

  it('does not steal a pin that is already dragging', async () => {
    const create = jest.spyOn(PanResponder, 'create');
    const { result } = await renderCanvas();
    const config = create.mock.calls.at(-1)![0] as any;
    result.current.setChildDragging(true);

    expect(
      config.onMoveShouldSetPanResponderCapture(
        { nativeEvent: { touches: [{}] } },
        { dx: 20, dy: 0 },
      ),
    ).toBe(false);
  });

  it('treats a mouse event without a touches list as a one-finger drag', async () => {
    const config = await configOf();

    expect(config.onMoveShouldSetPanResponderCapture({ nativeEvent: {} }, { dx: 20, dy: 0 })).toBe(
      true,
    );
  });

  it('takes over immediately for a second finger, however small the movement', async () => {
    const config = await configOf();

    expect(
      config.onMoveShouldSetPanResponderCapture(
        { nativeEvent: { touches: [{}, {}] } },
        { dx: 0, dy: 0 },
      ),
    ).toBe(true);
  });

  /**
   * The canvas owns whatever no child claimed. Without this a tap on the drawing itself is dropped
   * for want of an owner, and covering the drawing with touch targets to get it back would take the
   * responder on the way down and kill the pinch.
   */
  it('takes a touch that no child claimed', async () => {
    const config = await configOf();

    expect(config.onStartShouldSetPanResponder()).toBe(true);
  });

  it('does not take the background while a pin is dragging', async () => {
    const create = jest.spyOn(PanResponder, 'create');
    const { result } = await renderCanvas();
    const config = create.mock.calls.at(-1)![0] as any;
    result.current.setChildDragging(true);

    expect(config.onStartShouldSetPanResponder()).toBe(false);
    expect(
      config.onMoveShouldSetPanResponder({ nativeEvent: { touches: [{}] } }, { dx: 20, dy: 0 }),
    ).toBe(false);
  });

  /** Releasing the canvas mid-drag would make the map jump on the next interaction. */
  it('does not hand the gesture over once it has taken it', async () => {
    const config = await configOf();

    expect(config.onPanResponderTerminationRequest()).toBe(false);
  });

  it('resets the gesture tracking when the responder is terminated', async () => {
    const config = await configOf();

    expect(() => config.onPanResponderTerminate()).not.toThrow();
  });
});

describe('panning', () => {
  const moveWith = async (steps: { dx: number; dy: number }[], zoom = 4) => {
    const create = jest.spyOn(PanResponder, 'create');
    const { result, ref } = await renderCanvas();
    const config = create.mock.calls.at(-1)![0] as any;
    await act(async () => {
      ref.current!.zoomBy(zoom);
    });
    const before = transformOf(result.current);

    await act(async () => {
      config.onPanResponderGrant();
      for (const step of steps) {
        config.onPanResponderMove({ nativeEvent: { touches: [{}] } }, step);
      }
    });
    jest.restoreAllMocks();
    return { before, after: transformOf(result.current) };
  };

  it('moves the drawing by the drag delta', async () => {
    const { before, after } = await moveWith([{ dx: -50, dy: -40 }]);

    expect(after.x).toBeLessThan(before.x);
    expect(after.y).toBeLessThan(before.y);
  });

  it('slides a drawing that still fits the window when freePan is on', async () => {
    const create = jest.spyOn(PanResponder, 'create');
    const { result } = await renderCanvas({ width: 100, height: 100 }, VIEWPORT, {
      maxScale: 1,
      clampMode: 'free',
    });
    const config = create.mock.calls.at(-1)![0] as any;
    const before = transformOf(result.current);

    await act(async () => {
      config.onPanResponderGrant();
      config.onPanResponderMove({ nativeEvent: { touches: [{}] } }, { dx: 40, dy: 25 });
    });
    jest.restoreAllMocks();

    const after = transformOf(result.current);
    expect(after.x).toBeGreaterThan(before.x);
    expect(after.y).toBeGreaterThan(before.y);
  });

  it('treats the gesture delta as cumulative, not incremental', async () => {
    const oneStep = await moveWith([{ dx: -60, dy: 0 }]);
    const twoSteps = await moveWith([
      { dx: -30, dy: 0 },
      { dx: -60, dy: 0 },
    ]);

    expect(twoSteps.after.x).toBeCloseTo(oneStep.after.x, 3);
  });

  it('cannot be dragged past the edge of the drawing', async () => {
    const { after } = await moveWith([{ dx: 5000, dy: 5000 }]);

    expect(after.x).toBeLessThanOrEqual(0.001);
    expect(after.y).toBeLessThanOrEqual(0.001);
  });

  it('leaves a drawing smaller than the viewport centred, however hard it is dragged', async () => {
    const { before, after } = await moveWith([{ dx: -500, dy: -500 }], 1);

    expect(after).toEqual(before);
  });
});

/** `onTap` reports where on the drawing the finger landed, undoing the pan and the zoom. */
describe('tapping', () => {
  const tapAfter = async (
    steps: { dx: number; dy: number; touches?: number }[],
    release: { pageX: number; pageY: number; dx: number; dy: number },
    zoom = 1,
  ) => {
    const onTap = jest.fn();
    const create = jest.spyOn(PanResponder, 'create');
    const { ref, result } = await renderCanvas(LAYOUT, VIEWPORT, { onTap });
    const config = create.mock.calls.at(-1)![0] as any;
    if (zoom !== 1) {
      await act(async () => {
        ref.current!.zoomBy(zoom);
      });
    }

    await act(async () => {
      config.onPanResponderGrant({ nativeEvent: { touches: [{}] } });
      for (const step of steps) {
        config.onPanResponderMove(
          { nativeEvent: { touches: Array.from({ length: step.touches ?? 1 }, () => ({})) } },
          step,
        );
      }
      config.onPanResponderRelease(
        { nativeEvent: { pageX: release.pageX, pageY: release.pageY } },
        { dx: release.dx, dy: release.dy },
      );
    });
    jest.restoreAllMocks();
    return { onTap, transform: transformOf(result.current) };
  };

  /** The point of the screen, undoing the framing the canvas is currently showing. */
  const drawingPointOf = (
    page: { pageX: number; pageY: number },
    transform: { x: number; y: number; scale: number },
  ) => ({
    x: (page.pageX - transform.x) / transform.scale,
    y: (page.pageY - transform.y) / transform.scale,
  });

  it('reports the point of the drawing under the finger', async () => {
    const page = { pageX: 40, pageY: 30 };
    const { onTap, transform } = await tapAfter([], { ...page, dx: 0, dy: 0 });

    expect(onTap).toHaveBeenCalledWith(drawingPointOf(page, transform));
  });

  it('undoes the zoom, so a point further right on screen is further right on the drawing', async () => {
    const { onTap, transform } = await tapAfter([], { pageX: 200, pageY: 150, dx: 0, dy: 0 }, 2);

    const [point] = onTap.mock.calls.at(-1)!;
    expect(transform.scale).toBeGreaterThan(0);
    expect(point).toEqual(drawingPointOf({ pageX: 200, pageY: 150 }, transform));
    expect(point.x).toBeGreaterThan(200);
  });

  it('does not read a drag as a tap', async () => {
    const { onTap } = await tapAfter([{ dx: -60, dy: 0 }], {
      pageX: 40,
      pageY: 30,
      dx: -60,
      dy: 0,
    });

    expect(onTap).not.toHaveBeenCalled();
  });

  it('does not read the end of a pinch as a tap', async () => {
    const { onTap } = await tapAfter([{ dx: 0, dy: 0, touches: 2 }], {
      pageX: 40,
      pageY: 30,
      dx: 0,
      dy: 0,
    });

    expect(onTap).not.toHaveBeenCalled();
  });
});

describe('the viewport-sized overlay', () => {
  it('allocates a native surface from the device viewport, not a world-sized square', async () => {
    const { result } = await renderCanvas(BOUNDS, VIEWPORT, { clampMode: 'none' });

    expect(result.current.width).toBe(1200);
    expect(result.current.height).toBe(900);
    expect(result.current.width).toBeLessThanOrEqual(MAX_SPATIAL_NATIVE_SURFACE);
    expect(result.current.height).toBeLessThanOrEqual(MAX_SPATIAL_NATIVE_SURFACE);
  });

  it('keeps the native surface bounded even when the document is enormous', async () => {
    const { result } = await renderCanvas(
      { x: -50_000, y: -50_000, width: 100_000, height: 100_000 },
      VIEWPORT,
      { clampMode: 'none' },
    );

    expect(result.current.width).toBe(1200);
    expect(result.current.height).toBe(900);
  });

  it('commits no React state while a pan stays comfortably inside the overlay', async () => {
    const create = jest.spyOn(PanResponder, 'create');
    const { result, ref } = await renderCanvas(BOUNDS, VIEWPORT, { clampMode: 'none' });
    const config = create.mock.calls.at(-1)![0] as any;
    await act(async () => {
      ref.current!.zoomBy(4);
    });
    const renderBefore = result.current;
    const overlayBefore = result.current.renderWindow;

    await act(async () => {
      config.onPanResponderGrant();
      config.onPanResponderMove({ nativeEvent: { touches: [{}] } }, { dx: -10, dy: -8 });
      config.onPanResponderMove({ nativeEvent: { touches: [{}] } }, { dx: -20, dy: -15 });
    });
    jest.restoreAllMocks();

    // The camera moved (the Animated values are fresh), but no overlay re-sync fired, so React
    // never re-rendered: there is no second channel that could land a frame late and teleport
    // the drawing on Android.
    expect(transformOf(result.current).x).toBeLessThan(0);
    expect(result.current).toBe(renderBefore);
    expect(result.current.renderWindow).toBe(overlayBefore);
  });

  it('re-syncs the overlay atomically once a pan drifts past the margin', async () => {
    const create = jest.spyOn(PanResponder, 'create');
    const { result, ref } = await renderCanvas(BOUNDS, VIEWPORT, { clampMode: 'none' });
    const config = create.mock.calls.at(-1)![0] as any;
    await act(async () => {
      ref.current!.zoomBy(4);
    });

    await act(async () => {
      config.onPanResponderGrant();
      config.onPanResponderMove({ nativeEvent: { touches: [{}] } }, { dx: -1200, dy: 0 });
    });
    jest.restoreAllMocks();

    // One commit, internally consistent: the culling window is exactly the surface the new
    // origin covers at the live scale, so the edges layer recenters without moving anything.
    const { svgOrigin, width, height, renderWindow } = result.current;
    const { scale } = transformOf(result.current);
    expect(renderWindow).toEqual(spatialRenderWindow(svgOrigin, width, height, scale));
    expect(width).toBe(1200);
    expect(height).toBe(900);
  });

  it('leaves the overlay alone for a zoom inside the scale drift', async () => {
    const { result, ref } = await renderCanvas(BOUNDS, VIEWPORT, { clampMode: 'none' });
    const overlayBefore = result.current.renderWindow;

    await act(async () => {
      ref.current!.zoomBy(1.1);
    });

    expect(result.current.renderWindow).toBe(overlayBefore);
  });

  it('re-syncs the overlay once a zoom drifts the scale past the threshold', async () => {
    const { result, ref } = await renderCanvas(BOUNDS, VIEWPORT, { clampMode: 'none' });
    const overlayBefore = result.current.renderWindow;

    await act(async () => {
      ref.current!.zoomBy(2);
    });

    // The edges SVG is sized in world units, so without this re-sync its native bitmap would
    // double with the zoom and eventually blow past the GPU texture limit.
    expect(result.current.renderWindow).not.toBe(overlayBefore);
    const { svgOrigin, width, height, renderWindow } = result.current;
    const { scale } = transformOf(result.current);
    expect(renderWindow).toEqual(spatialRenderWindow(svgOrigin, width, height, scale));
    expect(renderWindow.width * scale).toBeCloseTo(width, 3);
    expect(renderWindow.height * scale).toBeCloseTo(height, 3);
  });

  it('keeps the live pinch scale out of React state until the gesture ends', async () => {
    const create = jest.spyOn(PanResponder, 'create');
    const { result } = await renderCanvas(BOUNDS, VIEWPORT, { clampMode: 'none' });
    const config = create.mock.calls.at(-1)![0] as any;
    const fittedScale = result.current.scale;

    await act(async () => {
      config.onPanResponderGrant({ nativeEvent: { touches: [{}, {}] } });
      config.onPanResponderMove(
        {
          nativeEvent: {
            touches: [
              { pageX: 100, pageY: 150 },
              { pageX: 200, pageY: 150 },
            ],
          },
        },
        { dx: 0, dy: 0 },
      );
      config.onPanResponderMove(
        {
          nativeEvent: {
            touches: [
              { pageX: 50, pageY: 150 },
              { pageX: 250, pageY: 150 },
            ],
          },
        },
        { dx: 0, dy: 0 },
      );
    });

    expect(transformOf(result.current).scale).toBeCloseTo(fittedScale * 2, 4);
    expect(result.current.scale).toBe(fittedScale);

    await act(async () => {
      config.onPanResponderRelease({ nativeEvent: {} }, { dx: 0, dy: 0 });
    });
    jest.restoreAllMocks();

    expect(result.current.scale).toBeCloseTo(fittedScale * 2, 4);
  });
});

describe('reframing and coordinate helpers', () => {
  it('re-fits when the drawing changes size and the option asks for it', async () => {
    const ref = createRef<CanvasViewportHandle>();
    const view = await renderHook(
      ({ bounds }: { bounds: CanvasViewportBounds }) =>
        useCanvasViewport(ref, bounds, { refitOnLayoutChange: true }),
      { initialProps: { bounds: { ...LAYOUT } } },
    );
    (view.result.current.containerRef as any).current = {
      measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
        callback(VIEWPORT.x, VIEWPORT.y, VIEWPORT.width, VIEWPORT.height),
    };
    await act(async () => {
      view.result.current.handleLayout();
    });
    const fitted = transformOf(view.result.current).scale;

    // A new object, not a mutation: the hook compares by reference to notice the change.
    await view.rerender({ bounds: { ...LAYOUT, width: 100, height: 80 } });
    await act(async () => {
      view.result.current.handleLayout();
    });

    expect(transformOf(view.result.current).scale).toBeGreaterThan(fitted);
  });

  it('converts between screen and world coordinates and exposes the live scale', async () => {
    const { result } = await renderCanvas();

    const world = { x: 100, y: 50 };
    const screen = result.current.worldToScreen(world);
    expect(result.current.screenToWorld(screen)).toEqual(
      expect.objectContaining({ x: expect.closeTo(100, 5), y: expect.closeTo(50, 5) }),
    );
    expect(result.current.scale).toBeCloseTo(transformOf(result.current).scale, 5);
  });
});

/**
 * The drag only has an effect with the drawing bigger than the window - while it fits entirely, the
 * `clamp` deliberately keeps it centred. That is why each case zooms in first.
 */

describe('auto-pan at the edges', () => {
  let frames: Array<(timestamp: number) => void>;
  let realRaf: unknown;
  let realCancel: unknown;

  beforeEach(() => {
    frames = [];
    realRaf = (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame;
    realCancel = (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame;
    (globalThis as any).requestAnimationFrame = (callback: (timestamp: number) => void) => {
      frames.push(callback);
      return frames.length;
    };
    (globalThis as any).cancelAnimationFrame = (handle: number) => {
      frames[handle - 1] = () => {};
    };
  });

  afterEach(() => {
    (globalThis as any).requestAnimationFrame = realRaf;
    (globalThis as any).cancelAnimationFrame = realCancel;
  });

  const runFrames = async (count: number) => {
    for (let index = 0; index < count; index += 1) {
      const pending = frames.splice(0);
      await act(async () => {
        pending.forEach((callback, slot) => callback(1000 + index * 16 + slot));
      });
    }
  };

  it('drifts the camera while the pointer holds the edge, and stops in the middle', async () => {
    const { ref, result } = await renderCanvas();
    // The fitted drawing is clamp-locked at the centre: zoom in so the camera can move.
    await act(async () => {
      ref.current!.zoomBy(4);
    });
    const before = result.current.getTransform();

    await act(async () => {
      result.current.updateAutoPan({ x: 399, y: 150 });
    });
    expect(frames).toHaveLength(1);
    await runFrames(3);

    // The pointer pushes the edge outward, so the drawing slides the other way.
    expect(result.current.getTransform().x).toBeLessThan(before.x);

    await act(async () => {
      result.current.updateAutoPan({ x: 200, y: 150 });
    });
    const settled = result.current.getTransform();
    await runFrames(2);
    expect(result.current.getTransform()).toEqual(settled);
  });

  it('pans from any edge and reports the drift to the drag handler', async () => {
    const moved: Array<{ x: number; y: number }> = [];
    const ref = createRef<CanvasViewportHandle>();
    const view = await renderHook(() =>
      useCanvasViewport(ref, LAYOUT, {
        onAutoPan: (delta) => {
          moved.push(delta);
        },
      }),
    );
    (view.result.current.containerRef as any).current = {
      measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
        callback(VIEWPORT.x, VIEWPORT.y, VIEWPORT.width, VIEWPORT.height),
    };
    await act(async () => {
      view.result.current.handleLayout();
    });
    await act(async () => {
      ref.current!.zoomBy(4);
    });

    await act(async () => {
      view.result.current.updateAutoPan({ x: 10, y: 10 });
    });
    await runFrames(2);

    expect(moved.length).toBeGreaterThan(0);
    // The handler reports the camera drift in world coordinates: the drawing slides toward
    // the bottom-right, so the camera moves toward the top-left.
    expect(moved[0]?.x).toBeLessThan(0);
    expect(moved[0]?.y).toBeLessThan(0);
  });

  it('stops panning when the child drag ends', async () => {
    const { ref, result } = await renderCanvas();
    await act(async () => {
      ref.current!.zoomBy(4);
    });
    await act(async () => {
      result.current.updateAutoPan({ x: 399, y: 150 });
    });
    expect(frames).toHaveLength(1);

    await act(async () => {
      result.current.setChildDragging(false);
    });
    const settled = result.current.getTransform();
    await runFrames(2);
    expect(result.current.getTransform()).toEqual(settled);
  });
});

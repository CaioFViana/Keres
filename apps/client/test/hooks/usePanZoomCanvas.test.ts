/**
 * @jest-environment node
 */
import { renderHook } from '@testing-library/react-native';
import { createRef } from 'react';
import { PanResponder } from 'react-native';
import { usePanZoomCanvas, type PanZoomCanvasHandle } from '../../src/hooks/usePanZoomCanvas';

const LAYOUT = { width: 1000, height: 800 };
const VIEWPORT = { x: 0, y: 0, width: 400, height: 300 };

/** Valor atual de cada `Animated.Value` do transform devolvido pelo hook. */
function transformOf(current: ReturnType<typeof usePanZoomCanvas>) {
  const [{ translateX }, { translateY }, { scale }] = current.animatedTransform as any[];
  return {
    x: (translateX as any)._value as number,
    y: (translateY as any)._value as number,
    scale: (scale as any)._value as number,
  };
}

/**
 * Monta o hook e simula o `onLayout`, que é o momento em que a janela passa a ter tamanho -
 * antes disso o hook não tem como enquadrar nada.
 */
async function renderCanvas(layout = LAYOUT, viewport = VIEWPORT, options = {}) {
  const ref = createRef<PanZoomCanvasHandle>();
  const view = await renderHook(() => usePanZoomCanvas(ref, layout, options));

  (view.result.current.containerRef as any).current = {
    measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
      callback(viewport.x, viewport.y, viewport.width, viewport.height),
  };
  view.result.current.handleLayout();

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
    result.current.handleLayout();

    expect(transformOf(result.current)).toEqual(fitted);
  });
});

describe('the handle exposed to the screen', () => {
  it('re-fits on demand', async () => {
    const { result, ref } = await renderCanvas();
    ref.current!.zoomBy(2);

    ref.current!.fitToScreen();

    expect(transformOf(result.current).scale).toBeCloseTo(0.375 * 0.94, 4);
  });

  it('zooms in around the centre of the viewport', async () => {
    const { result, ref } = await renderCanvas();
    const before = transformOf(result.current);

    ref.current!.zoomBy(2);

    expect(transformOf(result.current).scale).toBeCloseTo(before.scale * 2, 4);
  });

  it('zooms out too', async () => {
    const { result, ref } = await renderCanvas();
    const before = transformOf(result.current);

    ref.current!.zoomBy(0.5);

    expect(transformOf(result.current).scale).toBeCloseTo(before.scale * 0.5, 4);
  });

  it('never zooms past the maximum', async () => {
    const { result, ref } = await renderCanvas(LAYOUT, VIEWPORT, { maxScale: 2 });

    ref.current!.zoomBy(100);

    expect(transformOf(result.current).scale).toBe(2);
  });

  it('never zooms below the minimum', async () => {
    const { result, ref } = await renderCanvas(LAYOUT, VIEWPORT, { minScale: 0.15 });

    ref.current!.zoomBy(0.001);

    expect(transformOf(result.current).scale).toBe(0.15);
  });
});

/**
 * A regra que impede o usuário de "perder" o grafo: enquanto o desenho couber na janela ele
 * fica centralizado, e quando for maior não pode ser arrastado até sair de vista.
 */
describe('keeping the drawing reachable', () => {
  it('centres a drawing smaller than the viewport, whatever the zoom', async () => {
    const { result, ref } = await renderCanvas({ width: 100, height: 100 }, VIEWPORT, {
      maxScale: 1,
    });

    ref.current!.zoomBy(0.5);

    const { x, y, scale } = transformOf(result.current);
    expect(x).toBeCloseTo((VIEWPORT.width - 100 * scale) / 2, 3);
    expect(y).toBeCloseTo((VIEWPORT.height - 100 * scale) / 2, 3);
  });

  it('never leaves a gap on the left or top of a drawing larger than the viewport', async () => {
    const { result, ref } = await renderCanvas();

    ref.current!.zoomBy(4);

    const { x, y } = transformOf(result.current);
    expect(x).toBeLessThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(0);
  });

  it('never leaves a gap on the right or bottom either', async () => {
    const { result, ref } = await renderCanvas();

    ref.current!.zoomBy(4);

    const { x, y, scale } = transformOf(result.current);
    expect(x).toBeGreaterThanOrEqual(VIEWPORT.width - LAYOUT.width * scale);
    expect(y).toBeGreaterThanOrEqual(VIEWPORT.height - LAYOUT.height * scale);
  });
});

/**
 * As decisões de gesto são afirmadas sobre a config entregue ao `PanResponder`, e não sobre
 * os `panHandlers` prontos: aqueles são embrulhados pelo React Native, que faz a própria
 * contabilidade de toques antes de delegar, e alimentá-los exigiria forjar um evento nativo
 * completo sem ganhar nada em confiança.
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

  it('takes over immediately for a second finger, however small the movement', async () => {
    const config = await configOf();

    expect(
      config.onMoveShouldSetPanResponderCapture(
        { nativeEvent: { touches: [{}, {}] } },
        { dx: 0, dy: 0 },
      ),
    ).toBe(true);
  });

  /** Soltar o canvas no meio do arraste faria o mapa saltar na próxima interação. */
  it('does not hand the gesture over once it has taken it', async () => {
    const config = await configOf();

    expect(config.onPanResponderTerminationRequest()).toBe(false);
  });
});

/**
 * O arraste só tem efeito com o desenho maior que a janela - enquanto ele couber inteiro, o
 * `clamp` o mantém centralizado de propósito. Por isso cada caso dá zoom antes.
 */
describe('panning', () => {
  const moveWith = async (steps: { dx: number; dy: number }[], zoom = 4) => {
    const create = jest.spyOn(PanResponder, 'create');
    const { result, ref } = await renderCanvas();
    const config = create.mock.calls.at(-1)![0] as any;
    ref.current!.zoomBy(zoom);
    const before = transformOf(result.current);

    config.onPanResponderGrant();
    for (const step of steps) {
      config.onPanResponderMove({ nativeEvent: { touches: [{}] } }, step);
    }
    jest.restoreAllMocks();
    return { before, after: transformOf(result.current) };
  };

  it('moves the drawing by the drag delta', async () => {
    const { before, after } = await moveWith([{ dx: -50, dy: -40 }]);

    expect(after.x).toBeLessThan(before.x);
    expect(after.y).toBeLessThan(before.y);
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

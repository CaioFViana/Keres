import { useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import type { View } from 'react-native';
import { Animated, PanResponder } from 'react-native';

/**
 * Pan e zoom compartilhados pelos canvas de grafo (mapa de história, mapa de relações).
 *
 * Extraído depois que o segundo canvas surgiu duplicando ~150 linhas desta lógica quase
 * sem alteração. `PanResponder`, e não `react-native-gesture-handler`, porque o app não monta
 * `GestureHandlerRootView` na raiz - usar a biblioteca aqui exigiria mexer no provedor de
 * toda a aplicação por causa de duas telas.
 *
 * Recebe o `ref` encaminhado do componente e resolve o `useImperativeHandle` internamente -
 * assim `fitToScreen`/`zoomBy` continuam expostos ao componente pai sem cada canvas precisar
 * repetir esse encanamento.
 */

const DEFAULT_MIN_SCALE = 0.15;
const DEFAULT_MAX_SCALE = 2.5;
/** Movimento (em px) a partir do qual o gesto deixa de ser toque e passa a ser arraste. */
const DRAG_THRESHOLD = 5;
/** Sobra do "caber na tela" para o mapa não encostar nas bordas. */
const FIT_MARGIN = 0.94;

export interface PanZoomCanvasHandle {
  fitToScreen(): void;
  zoomBy(factor: number): void;
}

/** O que o hook precisa saber do desenho: o tamanho total, e uma identidade que muda quando os dados mudam. */
export interface PanZoomLayout {
  width: number;
  height: number;
}

interface PanZoomCanvasOptions {
  minScale?: number;
  maxScale?: number;
  /** Matrizes começam no topo; grafos permanecem centralizados. */
  fitVerticalAlignment?: 'center' | 'top';
  /** Mantém a posição atual quando os dados da visualização mudam. */
  refitOnLayoutChange?: boolean;
  /** Algumas visualizações, como uma timeline, devem preservar a escala vertical e rolar na horizontal. */
  fitMode?: 'contain' | 'height';
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

export function usePanZoomCanvas(
  ref: React.ForwardedRef<PanZoomCanvasHandle>,
  layout: PanZoomLayout,
  options: PanZoomCanvasOptions = {},
) {
  const minScale = options.minScale ?? DEFAULT_MIN_SCALE;
  const maxScale = options.maxScale ?? DEFAULT_MAX_SCALE;
  const fitVerticalAlignment = options.fitVerticalAlignment ?? 'center';
  const refitOnLayoutChange = options.refitOnLayoutChange ?? true;
  const fitMode = options.fitMode ?? 'contain';

  const viewport = useRef({ width: 0, height: 0 });
  /** Canto do canvas na janela, para converter o foco da pinça em coordenadas locais. */
  const viewportOrigin = useRef({ x: 0, y: 0 });
  const containerRef = useRef<View>(null);

  const transform = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const animatedScale = useRef(new Animated.Value(1)).current;
  const animatedX = useRef(new Animated.Value(0)).current;
  const animatedY = useRef(new Animated.Value(0)).current;

  /** Estado do gesto em andamento; zerado a cada toque novo. */
  const gesture = useRef({ lastDx: 0, lastDy: 0, pinchDistance: 0, pinchScale: 1 });
  /** Identidade do último layout que já foi enquadrado, para não reenquadrar a cada render. */
  const fittedLayout = useRef<PanZoomLayout | null>(null);

  const publish = useCallback(() => {
    animatedScale.setValue(transform.current.scale);
    animatedX.setValue(transform.current.x);
    animatedY.setValue(transform.current.y);
  }, [animatedScale, animatedX, animatedY]);

  /**
   * Mantém o mapa dentro da janela: quando ele é maior, não deixa arrastar até sair de
   * vista; quando é menor, centraliza. Sem isso é fácil "perder" o grafo e não achar mais.
   */
  const clamp = useCallback(() => {
    const { width: viewportWidth, height: viewportHeight } = viewport.current;
    if (viewportWidth === 0 || viewportHeight === 0) return;

    const scaledWidth = layout.width * transform.current.scale;
    const scaledHeight = layout.height * transform.current.scale;

    transform.current.x =
      scaledWidth <= viewportWidth
        ? (viewportWidth - scaledWidth) / 2
        : Math.min(0, Math.max(viewportWidth - scaledWidth, transform.current.x));

    transform.current.y =
      scaledHeight <= viewportHeight
        ? fitVerticalAlignment === 'top'
          ? 0
          : (viewportHeight - scaledHeight) / 2
        : Math.min(0, Math.max(viewportHeight - scaledHeight, transform.current.y));
  }, [fitVerticalAlignment, layout.height, layout.width]);

  /** Aplica um zoom mantendo fixo o ponto do mapa que está sob `focus`. */
  const zoomAround = useCallback(
    (nextScale: number, focus: { x: number; y: number }) => {
      const previous = transform.current.scale;
      const clamped = Math.max(minScale, Math.min(maxScale, nextScale));
      if (clamped === previous) return;

      transform.current.x = focus.x - ((focus.x - transform.current.x) * clamped) / previous;
      transform.current.y = focus.y - ((focus.y - transform.current.y) * clamped) / previous;
      transform.current.scale = clamped;
      clamp();
      publish();
    },
    [clamp, maxScale, minScale, publish],
  );

  const fitToScreen = useCallback(() => {
    const { width: viewportWidth, height: viewportHeight } = viewport.current;
    if (viewportWidth === 0 || viewportHeight === 0 || layout.width === 0 || layout.height === 0)
      return;

    const containedScale = Math.min(viewportWidth / layout.width, viewportHeight / layout.height);
    const targetScale = fitMode === 'height' ? viewportHeight / layout.height : containedScale;
    const scale = Math.max(minScale, Math.min(maxScale, targetScale * FIT_MARGIN));
    transform.current = {
      scale,
      x: (viewportWidth - layout.width * scale) / 2,
      y: fitVerticalAlignment === 'top' ? 0 : (viewportHeight - layout.height * scale) / 2,
    };
    clamp();
    publish();
  }, [
    clamp,
    fitMode,
    fitVerticalAlignment,
    layout.height,
    layout.width,
    maxScale,
    minScale,
    publish,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      fitToScreen,
      zoomBy: (factor: number) => {
        zoomAround(transform.current.scale * factor, {
          x: viewport.current.width / 2,
          y: viewport.current.height / 2,
        });
      },
    }),
    [fitToScreen, zoomAround],
  );

  const handleLayout = useCallback(() => {
    containerRef.current?.measureInWindow((x, y, width, height) => {
      viewportOrigin.current = { x, y };
      viewport.current = { width, height };
      // Primeiro enquadramento só é possível quando se conhece o tamanho da janela, o que
      // acontece depois do primeiro render.
      if (!fittedLayout.current || (refitOnLayoutChange && fittedLayout.current !== layout)) {
        fittedLayout.current = layout;
        fitToScreen();
      }
    });
  }, [fitToScreen, layout, refitOnLayoutChange]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Não captura o início do toque: assim um toque simples chega ao nó e abre os
        // detalhes. O arraste é roubado do nó depois, na fase de captura do movimento.
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (event, gestureState) =>
          event.nativeEvent.touches.length > 1 ||
          Math.hypot(gestureState.dx, gestureState.dy) > DRAG_THRESHOLD,

        onPanResponderGrant: () => {
          gesture.current = {
            lastDx: 0,
            lastDy: 0,
            pinchDistance: 0,
            pinchScale: transform.current.scale,
          };
        },

        onPanResponderMove: (event, gestureState) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            const [first, second] = touches;
            const distance = Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
            const focus = {
              x: (first.pageX + second.pageX) / 2 - viewportOrigin.current.x,
              y: (first.pageY + second.pageY) / 2 - viewportOrigin.current.y,
            };

            if (gesture.current.pinchDistance === 0) {
              gesture.current.pinchDistance = distance;
              gesture.current.pinchScale = transform.current.scale;
            } else if (distance > 0) {
              zoomAround(
                (gesture.current.pinchScale * distance) / gesture.current.pinchDistance,
                focus,
              );
            }
            // Zera o arraste para o dedo que sai da pinça não dar um salto no mapa.
            gesture.current.lastDx = gestureState.dx;
            gesture.current.lastDy = gestureState.dy;
            return;
          }

          gesture.current.pinchDistance = 0;
          transform.current.x += gestureState.dx - gesture.current.lastDx;
          transform.current.y += gestureState.dy - gesture.current.lastDy;
          gesture.current.lastDx = gestureState.dx;
          gesture.current.lastDy = gestureState.dy;
          clamp();
          publish();
        },

        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: () => {
          gesture.current.pinchDistance = 0;
        },
        onPanResponderTerminate: () => {
          gesture.current.pinchDistance = 0;
        },
      }),
    [clamp, publish, zoomAround],
  );

  return {
    containerRef,
    handleLayout,
    panHandlers: panResponder.panHandlers,
    animatedTransform: [
      { translateX: animatedX },
      { translateY: animatedY },
      { scale: animatedScale },
    ],
  };
}

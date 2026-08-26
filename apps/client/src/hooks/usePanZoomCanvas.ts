import { useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import type { View } from 'react-native';
import { Animated, PanResponder } from 'react-native';

/**
 * Pan and zoom shared by the graph canvases (story map, relations map).
 *
 * Extracted after the second canvas appeared duplicating ~150 lines of this logic almost
 * unchanged. `PanResponder`, and not `react-native-gesture-handler`, because the app does not mount
 * `GestureHandlerRootView` at the root - using the library here would mean touching the provider of
 * the whole application for the sake of two screens.
 *
 * It takes the `ref` forwarded from the component and resolves the `useImperativeHandle` internally -
 * that way `fitToScreen`/`zoomBy` stay exposed to the parent component without each canvas having to
 * repeat that plumbing.
 */

const DEFAULT_MIN_SCALE = 0.15;
const DEFAULT_MAX_SCALE = 2.5;
/** Movimento (em px) a partir do qual o gesto deixa de ser toque e passa a ser arraste. */
const DRAG_THRESHOLD = 5;
/** Slack for "fit on screen" so the map does not touch the edges. */
const FIT_MARGIN = 0.94;

export interface PanZoomCanvasHandle {
  fitToScreen(): void;
  zoomBy(factor: number): void;
}

/** What the hook needs to know about the drawing: the total size, and an identity that changes when the data changes. */
export interface PanZoomLayout {
  width: number;
  height: number;
}

interface PanZoomCanvasOptions {
  minScale?: number;
  maxScale?: number;
  /** Matrices start at the top; graphs stay centred. */
  fitVerticalAlignment?: 'center' | 'top';
  /** Keeps the current position when the visualization's data changes. */
  refitOnLayoutChange?: boolean;
  /** Some visualizations, such as a timeline, must preserve the vertical scale and scroll horizontally. */
  fitMode?: 'contain' | 'height';
  /**
   * A tap that landed on the drawing, in its own coordinates (already undoing pan and zoom).
   *
   * It exists so that a canvas whose whole surface is meaningful - a timeline band, a matrix column -
   * can hit-test its own drawing instead of carpeting it with touch targets. Views that answer to
   * touch take the responder on the finger's way down, and a pinch that starts on one of them never
   * reaches the canvas: the map stops zooming as soon as the drawing covers the screen.
   */
  onTap?: (point: { x: number; y: number }) => void;
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
  /** In a ref so that changing the handler does not rebuild the `PanResponder` mid-gesture. */
  const onTap = useRef(options.onTap);
  onTap.current = options.onTap;

  const viewport = useRef({ width: 0, height: 0 });
  /** The canvas's corner within the window, to convert the pinch's focus into local coordinates. */
  const viewportOrigin = useRef({ x: 0, y: 0 });
  const containerRef = useRef<View>(null);

  const transform = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const animatedScale = useRef(new Animated.Value(1)).current;
  const animatedX = useRef(new Animated.Value(0)).current;
  const animatedY = useRef(new Animated.Value(0)).current;

  /** Estado do gesto em andamento; zerado a cada toque novo. */
  const gesture = useRef({ lastDx: 0, lastDy: 0, pinchDistance: 0, pinchScale: 1 });
  /** The gesture still qualifies as a tap: one finger, and no drag so far. */
  const tapping = useRef(false);
  /** The identity of the last layout already framed, so as not to reframe on every render. */
  const fittedLayout = useRef<PanZoomLayout | null>(null);

  const publish = useCallback(() => {
    animatedScale.setValue(transform.current.scale);
    animatedX.setValue(transform.current.x);
    animatedY.setValue(transform.current.y);
  }, [animatedScale, animatedX, animatedY]);

  /**
   * Keeps the map inside the window: when it is bigger, it does not let you drag it out of
   * sight; when it is smaller, it centres it. Without this it is easy to "lose" the graph and never find it again.
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

  /** Applies a zoom keeping fixed the point of the map that lies under `focus`. */
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
    const scaledWidth = layout.width * scale;
    transform.current = {
      scale,
      // Centring only makes sense when the drawing fits. Wider than the window - a timeline,
      // a matrix - centring cuts both sides off, and the left-hand side is where
      // the scene and thread names live. In that case the framing starts at the beginning.
      x: scaledWidth <= viewportWidth ? (viewportWidth - scaledWidth) / 2 : 0,
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
      // The first framing is only possible once the window's size is known, which
      // happens after the first render.
      if (!fittedLayout.current || (refitOnLayoutChange && fittedLayout.current !== layout)) {
        fittedLayout.current = layout;
        fitToScreen();
      }
    });
  }, [fitToScreen, layout, refitOnLayoutChange]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // It does not capture the touch's start: that way a simple tap reaches the node and opens the
        // details. The drag is stolen from the node later, in the move's capture phase.
        onStartShouldSetPanResponderCapture: () => false,
        // Whatever no child claimed belongs to the canvas, from the finger's way down: pan, pinch and
        // `onTap` all start here, instead of the gesture being dropped for want of an owner.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: (event, gestureState) =>
          event.nativeEvent.touches.length > 1 ||
          Math.hypot(gestureState.dx, gestureState.dy) > DRAG_THRESHOLD,

        onPanResponderGrant: (event) => {
          gesture.current = {
            lastDx: 0,
            lastDy: 0,
            pinchDistance: 0,
            pinchScale: transform.current.scale,
          };
          tapping.current = (event?.nativeEvent?.touches?.length ?? 1) <= 1;
        },

        onPanResponderMove: (event, gestureState) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            tapping.current = false;
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
            // Zeroes the drag so the finger leaving the pinch does not make the map jump.
            gesture.current.lastDx = gestureState.dx;
            gesture.current.lastDy = gestureState.dy;
            return;
          }

          gesture.current.pinchDistance = 0;
          if (Math.hypot(gestureState.dx, gestureState.dy) > DRAG_THRESHOLD)
            tapping.current = false;
          transform.current.x += gestureState.dx - gesture.current.lastDx;
          transform.current.y += gestureState.dy - gesture.current.lastDy;
          gesture.current.lastDx = gestureState.dx;
          gesture.current.lastDy = gestureState.dy;
          clamp();
          publish();
        },

        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (event, gestureState) => {
          gesture.current.pinchDistance = 0;
          const wasTap =
            tapping.current && Math.hypot(gestureState.dx, gestureState.dy) <= DRAG_THRESHOLD;
          tapping.current = false;
          if (!wasTap || !onTap.current) return;
          const { pageX, pageY } = event.nativeEvent;
          onTap.current({
            x: (pageX - viewportOrigin.current.x - transform.current.x) / transform.current.scale,
            y: (pageY - viewportOrigin.current.y - transform.current.y) / transform.current.scale,
          });
        },
        onPanResponderTerminate: () => {
          gesture.current.pinchDistance = 0;
          tapping.current = false;
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

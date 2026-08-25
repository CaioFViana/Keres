import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

/**
 * A full-screen image viewer, with pinch zoom, drag and double tap.
 *
 * It uses `PanResponder` (React Native's native API) instead of `react-native-gesture-handler`,
 * for the same reason as `StoryGraphCanvas`: the app does not mount `GestureHandlerRootView` at the
 * root, and adding that just because of this screen would touch the whole application's provider.
 * The pinch/drag/clamp maths mirrors the story map's.
 */

interface ImageZoomViewerProps {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

const MIN_SCALE = 1; // There is no zooming out past "fitted to the screen".
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
/** Acima disso o toque deixa de ser considerado toque e passa a ser arraste. */
const TAP_MOVE_THRESHOLD = 8;
/** Above that, two taps no longer count as a double tap. */
const DOUBLE_TAP_MAX_DELAY = 300;

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const ImageZoomViewer: React.FC<ImageZoomViewerProps> = ({ visible, uri, onClose }) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [content, setContent] = useState<{ width: number; height: number } | null>(null);

  const viewport = useRef({ width: windowWidth, height: windowHeight });
  viewport.current = { width: windowWidth, height: windowHeight };

  const transform = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const animatedScale = useRef(new Animated.Value(1)).current;
  const animatedX = useRef(new Animated.Value(0)).current;
  const animatedY = useRef(new Animated.Value(0)).current;

  const gesture = useRef({ lastDx: 0, lastDy: 0, pinchDistance: 0, pinchScale: 1 });
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const tapCandidate = useRef({ startX: 0, startY: 0, moved: false });

  const publish = useCallback(() => {
    animatedScale.setValue(transform.current.scale);
    animatedX.setValue(transform.current.x);
    animatedY.setValue(transform.current.y);
  }, [animatedScale, animatedX, animatedY]);

  /** Centres the image "fitted to the screen" - the same calculation as `resizeMode: contain`. */
  const fitToScreen = useCallback(
    (box: { width: number; height: number }) => {
      const { width: viewportWidth, height: viewportHeight } = viewport.current;
      const fitScale = Math.min(viewportWidth / box.width, viewportHeight / box.height);
      const fittedWidth = box.width * fitScale;
      const fittedHeight = box.height * fitScale;

      setContent({ width: fittedWidth, height: fittedHeight });
      transform.current = {
        scale: 1,
        x: (viewportWidth - fittedWidth) / 2,
        y: (viewportHeight - fittedHeight) / 2,
      };
      publish();
    },
    [publish],
  );

  useEffect(() => {
    if (!visible || !uri) {
      return;
    }
    let cancelled = false;
    Image.getSize(
      uri,
      (naturalWidth, naturalHeight) => {
        if (!cancelled) {
          fitToScreen({ width: naturalWidth, height: naturalHeight });
        }
      },
      () => {
        // With no natural size, it uses the whole screen as the basis - zoom still works, it just
        // starts from an approximate fit instead of the exact one.
        if (!cancelled) {
          fitToScreen({ width: viewport.current.width, height: viewport.current.height });
        }
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, uri]);

  /** Keeps the image reachable: it does not let you drag it off the screen when zoomed in. */
  const clamp = useCallback(() => {
    if (!content) return;
    const { width: viewportWidth, height: viewportHeight } = viewport.current;
    const scaledWidth = content.width * transform.current.scale;
    const scaledHeight = content.height * transform.current.scale;

    transform.current.x =
      scaledWidth <= viewportWidth
        ? (viewportWidth - scaledWidth) / 2
        : Math.min(0, Math.max(viewportWidth - scaledWidth, transform.current.x));

    transform.current.y =
      scaledHeight <= viewportHeight
        ? (viewportHeight - scaledHeight) / 2
        : Math.min(0, Math.max(viewportHeight - scaledHeight, transform.current.y));
  }, [content]);

  /** Applies a zoom keeping fixed the point of the image that lies under `focus`. */
  const zoomAround = useCallback(
    (nextScale: number, focus: { x: number; y: number }) => {
      const previous = transform.current.scale;
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
      if (clamped === previous) return;

      transform.current.x = focus.x - ((focus.x - transform.current.x) * clamped) / previous;
      transform.current.y = focus.y - ((focus.y - transform.current.y) * clamped) / previous;
      transform.current.scale = clamped;
      clamp();
      publish();
    },
    [clamp, publish],
  );

  const handleDoubleTap = useCallback(
    (focus: { x: number; y: number }) => {
      const isZoomed = transform.current.scale > MIN_SCALE + 0.01;
      if (isZoomed) {
        // Volta ao encaixe original, centralizado.
        if (content) {
          transform.current = {
            scale: 1,
            x: (viewport.current.width - content.width) / 2,
            y: (viewport.current.height - content.height) / 2,
          };
          publish();
        }
      } else {
        zoomAround(DOUBLE_TAP_SCALE, focus);
      }
    },
    [content, publish, zoomAround],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (event, gestureState) =>
          event.nativeEvent.touches.length > 1 ||
          Math.hypot(gestureState.dx, gestureState.dy) > TAP_MOVE_THRESHOLD,

        onPanResponderGrant: (event) => {
          gesture.current = {
            lastDx: 0,
            lastDy: 0,
            pinchDistance: 0,
            pinchScale: transform.current.scale,
          };
          const touch = event.nativeEvent.touches[0];
          tapCandidate.current = {
            startX: touch?.pageX ?? 0,
            startY: touch?.pageY ?? 0,
            moved: false,
          };
        },

        onPanResponderMove: (event, gestureState) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            const [first, second] = touches;
            const distance = Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
            const focus = {
              x: (first.pageX + second.pageX) / 2,
              y: (first.pageY + second.pageY) / 2,
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
            gesture.current.lastDx = gestureState.dx;
            gesture.current.lastDy = gestureState.dy;
            tapCandidate.current.moved = true;
            return;
          }

          if (Math.hypot(gestureState.dx, gestureState.dy) > TAP_MOVE_THRESHOLD) {
            tapCandidate.current.moved = true;
          }

          gesture.current.pinchDistance = 0;
          // Dragging only makes sense zoomed in; without this a drag at normal size
          // would decentre the image for no reason.
          if (transform.current.scale > MIN_SCALE + 0.01) {
            transform.current.x += gestureState.dx - gesture.current.lastDx;
            transform.current.y += gestureState.dy - gesture.current.lastDy;
            clamp();
            publish();
          }
          gesture.current.lastDx = gestureState.dx;
          gesture.current.lastDy = gestureState.dy;
        },

        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (event) => {
          gesture.current.pinchDistance = 0;

          if (tapCandidate.current.moved) {
            return;
          }

          const now = Date.now();
          const focus = { x: tapCandidate.current.startX, y: tapCandidate.current.startY };
          const previousTap = lastTap.current;

          if (
            previousTap &&
            now - previousTap.time < DOUBLE_TAP_MAX_DELAY &&
            Math.hypot(focus.x - previousTap.x, focus.y - previousTap.y) < 40
          ) {
            lastTap.current = null;
            handleDoubleTap(focus);
          } else {
            lastTap.current = { time: now, x: focus.x, y: focus.y };
          }
        },
        onPanResponderTerminate: () => {
          gesture.current.pinchDistance = 0;
        },
      }),
    [clamp, handleDoubleTap, publish, zoomAround],
  );

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: '#000000',
    },
    closeButton: {
      position: 'absolute',
      top: 44,
      right: 16,
      zIndex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 20,
      padding: 6,
    },
    image: {
      position: 'absolute',
      top: 0,
      left: 0,
      transformOrigin: 'top left',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop} {...panResponder.panHandlers}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={26} color="#ffffff" />
        </TouchableOpacity>
        {content && (
          <Animated.Image
            source={{ uri }}
            resizeMode="contain"
            style={[
              styles.image,
              {
                width: content.width,
                height: content.height,
                transform: [
                  { translateX: animatedX },
                  { translateY: animatedY },
                  { scale: animatedScale },
                ],
              },
            ]}
          />
        )}
      </View>
    </Modal>
  );
};

export default ImageZoomViewer;

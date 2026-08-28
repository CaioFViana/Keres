import React, { useMemo, useRef } from 'react';
import { Image, PanResponder, Platform, StyleSheet, View } from 'react-native';
import type { LocationMapImageType } from '@keres/shared';
import { useTheme } from '../../../theme';

const DRAG_THRESHOLD = 5;

interface Props {
  image: LocationMapImageType;
  uri: string | null;
  selected: boolean;
  scale: number;
  /** When locked, dragging on the image pans the canvas instead of moving the image. */
  locked: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

/**
 * An image base of the map: draggable and tappable (selecting it lets the person resize/remove it
 * through the image sheet). The drag responder is the same pattern as the board's pin.
 *
 * When locked, the image still claims the touch's start so a tap selects it, but it never starts a
 * child drag and never moves: the canvas's pan responder steals the gesture on movement, so
 * touching a locked image slides the whole map.
 */
const LocationMapImageView: React.FC<Props> = ({
  image,
  uri,
  selected,
  scale,
  locked,
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
}) => {
  const { colors } = useTheme();
  const origin = useRef({ x: image.x, y: image.y });
  const dragging = useRef(false);
  const position = useRef({ x: image.x, y: image.y });
  position.current = { x: image.x, y: image.y };
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const handlers = useRef({ onSelect, onMove, onDragStart, onDragEnd });
  handlers.current = { onSelect, onMove, onDragStart, onDragEnd };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => true,
        onStartShouldSetPanResponder: () => {
          if (!lockedRef.current) handlers.current.onDragStart();
          return true;
        },
        onMoveShouldSetPanResponderCapture: () => dragging.current,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !lockedRef.current && Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
        onPanResponderTerminationRequest: () => lockedRef.current,
        onPanResponderGrant: (event) => {
          dragging.current = false;
          origin.current = { x: position.current.x, y: position.current.y };
          if (!lockedRef.current) handlers.current.onDragStart();
          const pointerId = (event.nativeEvent as { pointerId?: number }).pointerId;
          const target = event.currentTarget as unknown as {
            setPointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.setPointerCapture?.(pointerId);
        },
        onPanResponderMove: (_event, gesture) => {
          if (lockedRef.current) return;
          if (Math.hypot(gesture.dx, gesture.dy) <= DRAG_THRESHOLD) return;
          dragging.current = true;
          const zoom = Math.max(scaleRef.current, 0.01);
          handlers.current.onMove(
            origin.current.x + gesture.dx / zoom,
            origin.current.y + gesture.dy / zoom,
          );
        },
        onPanResponderRelease: (event) => {
          const pointerId = (event.nativeEvent as { pointerId?: number }).pointerId;
          const target = event.currentTarget as unknown as {
            releasePointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.releasePointerCapture?.(pointerId);
          if (!lockedRef.current) handlers.current.onDragEnd();
          if (!dragging.current) handlers.current.onSelect();
          dragging.current = false;
        },
        onPanResponderTerminate: (event) => {
          const pointerId = (event.nativeEvent as { pointerId?: number }).pointerId;
          const target = event.currentTarget as unknown as {
            releasePointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.releasePointerCapture?.(pointerId);
          if (!lockedRef.current) handlers.current.onDragEnd();
          dragging.current = false;
        },
      }),
    [],
  );

  if (!dragging.current) origin.current = { x: image.x, y: image.y };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        image: {
          position: 'absolute',
          left: image.x,
          top: image.y,
          width: image.width,
          height: image.height,
          backgroundColor: colors.surface,
          borderWidth: selected ? 2.5 : 1,
          borderColor: selected ? colors.primary : colors.border,
          ...(Platform.OS === 'web'
            ? ({ userSelect: 'none', cursor: 'grab' } as Record<string, string>)
            : {}),
        },
      }),
    [colors, image.height, image.width, image.x, image.y, selected],
  );

  return (
    <View style={styles.image} {...pan.panHandlers}>
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="stretch" />
      ) : null}
    </View>
  );
};

export default LocationMapImageView;
import React, { useMemo, useRef } from 'react';
import { Image, PanResponder, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LocationMapImageType } from '@keres/shared';
import { useTheme } from '../../../theme';

const DRAG_THRESHOLD = 5;

interface Props {
  image: LocationMapImageType;
  uri: string | null;
  selected: boolean;
  layoutEditing: boolean;
  scale: number;
  /** Surface translation for the world-coordinate canvas. */
  positionOffsetX?: number;
  positionOffsetY?: number;
  /** When locked, dragging on the image pans the canvas instead of moving the image. */
  locked: boolean;
  onSelect: (imageId: string) => void;
  onMove: (imageId: string, x: number, y: number) => void;
  onResize: (imageId: string, width: number, height: number) => void;
  onDragStart: (imageId: string) => void;
  onDragEnd: (imageId: string) => void;
  onBringToFront: (imageId: string) => void;
  onSendToBack: (imageId: string) => void;
  onToggleLock: (imageId: string) => void;
  onRemove: (imageId: string) => void;
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
  layoutEditing,
  scale,
  positionOffsetX = 0,
  positionOffsetY = 0,
  locked,
  onSelect,
  onMove,
  onResize,
  onDragStart,
  onDragEnd,
  onBringToFront,
  onSendToBack,
  onToggleLock,
  onRemove,
}) => {
  const { colors } = useTheme();
  const origin = useRef({ x: image.x + positionOffsetX, y: image.y + positionOffsetY });
  const dragging = useRef(false);
  const imageId = useRef(image.id);
  imageId.current = image.id;
  const position = useRef({ x: image.x + positionOffsetX, y: image.y + positionOffsetY });
  position.current = { x: image.x + positionOffsetX, y: image.y + positionOffsetY };
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const layoutEditingRef = useRef(layoutEditing);
  layoutEditingRef.current = layoutEditing;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const handlers = useRef({
    onSelect,
    onMove,
    onResize,
    onDragStart,
    onDragEnd,
    onBringToFront,
    onSendToBack,
    onToggleLock,
    onRemove,
  });
  handlers.current = {
    onSelect,
    onMove,
    onResize,
    onDragStart,
    onDragEnd,
    onBringToFront,
    onSendToBack,
    onToggleLock,
    onRemove,
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => false,
        onStartShouldSetPanResponder: () => {
          if (layoutEditingRef.current && selectedRef.current) return false;
          if (!lockedRef.current) handlers.current.onDragStart(imageId.current);
          return true;
        },
        onMoveShouldSetPanResponderCapture: () =>
          dragging.current && !(layoutEditingRef.current && selectedRef.current),
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !(layoutEditingRef.current && selectedRef.current) &&
          !lockedRef.current &&
          Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
        onPanResponderTerminationRequest: () => lockedRef.current,
        onPanResponderGrant: (event) => {
          dragging.current = false;
          origin.current = { x: position.current.x, y: position.current.y };
          if (!lockedRef.current) handlers.current.onDragStart(imageId.current);
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
            imageId.current,
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
          if (!lockedRef.current) handlers.current.onDragEnd(imageId.current);
          if (!dragging.current) handlers.current.onSelect(imageId.current);
          dragging.current = false;
        },
        onPanResponderTerminate: (event) => {
          const pointerId = (event.nativeEvent as { pointerId?: number }).pointerId;
          const target = event.currentTarget as unknown as {
            releasePointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.releasePointerCapture?.(pointerId);
          if (!lockedRef.current) handlers.current.onDragEnd(imageId.current);
          dragging.current = false;
        },
      }),
    [],
  );

  if (!dragging.current)
    origin.current = { x: image.x + positionOffsetX, y: image.y + positionOffsetY };

  const sizeRef = useRef({ width: image.width, height: image.height });
  sizeRef.current = { width: image.width, height: image.height };
  const resizeOrigin = useRef(sizeRef.current);
  const resizePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => layoutEditing,
        onMoveShouldSetPanResponder: () => layoutEditing,
        onPanResponderGrant: () => {
          resizeOrigin.current = sizeRef.current;
          handlers.current.onDragStart(imageId.current);
        },
        onPanResponderMove: (_event, gesture) => {
          const zoom = Math.max(scaleRef.current, 0.01);
          const width = Math.max(80, resizeOrigin.current.width + gesture.dx / zoom);
          handlers.current.onResize(
            imageId.current,
            width,
            resizeOrigin.current.height * (width / resizeOrigin.current.width),
          );
        },
        onPanResponderRelease: () => handlers.current.onDragEnd(imageId.current),
        onPanResponderTerminate: () => handlers.current.onDragEnd(imageId.current),
      }),
    [layoutEditing],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        image: {
          position: 'absolute',
          left: image.x + positionOffsetX,
          top: image.y + positionOffsetY,
          width: image.width,
          height: image.height,
          backgroundColor: colors.surface,
          borderWidth: selected ? 2.5 : 1,
          borderColor: selected ? colors.primary : colors.border,
          ...(Platform.OS === 'web'
            ? ({ userSelect: 'none', cursor: 'grab' } as Record<string, string>)
            : {}),
        },
        resizeHandle: {
          position: 'absolute',
          right: -12,
          bottom: -12,
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          borderWidth: 2,
          borderColor: colors.surface,
          zIndex: 3,
        },
        actionButton: {
          position: 'absolute',
          top: -12,
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.primary,
          zIndex: 3,
        },
      }),
    [
      colors,
      image.height,
      image.width,
      image.x,
      image.y,
      positionOffsetX,
      positionOffsetY,
      selected,
    ],
  );

  return (
    <View style={styles.image} {...pan.panHandlers}>
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="stretch" />
      ) : null}
      {layoutEditing && selected && (
        <>
          <TouchableOpacity
            style={[styles.actionButton, { right: 84 }]}
            onPress={() => handlers.current.onSendToBack(imageId.current)}
            accessibilityLabel="Send map image to back"
          >
            <Ionicons name="layers-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { right: 48 }]}
            onPress={() => handlers.current.onBringToFront(imageId.current)}
            accessibilityLabel="Bring map image to front"
          >
            <Ionicons name="layers" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { right: 12 }]}
            onPress={() => handlers.current.onToggleLock(imageId.current)}
            accessibilityLabel="Toggle map image lock"
          >
            <Ionicons name={locked ? 'lock-closed-outline' : 'lock-open-outline'} size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { left: 12 }]}
            onPress={() => handlers.current.onRemove(imageId.current)}
            accessibilityLabel="Remove map image"
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </TouchableOpacity>
          <View
            style={styles.resizeHandle}
            {...resizePan.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="Resize map image"
          >
            <Ionicons name="expand-outline" size={16} color={colors.onPrimary} />
          </View>
        </>
      )}
    </View>
  );
};

export default React.memo(LocationMapImageView);

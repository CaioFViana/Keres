import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { LocationMapImageType } from '@keres/shared';
import { useTheme } from '@/src/theme';
import { capturePointer, releasePointer } from '@/src/utils/ui/pointerCapture';
import { usePanResponder } from '@/src/hooks/ui/usePanResponder';

const DRAG_THRESHOLD = 5;

interface Props {
  image: LocationMapImageType;
  uri: string | null;
  selected: boolean;
  layoutEditing: boolean;
  scale: number;
  /** When locked, dragging on the image pans the canvas instead of moving the image. */
  locked: boolean;
  /** While set, the image ignores taps and drags: only overlay shapes respond. */
  overlayEditing?: boolean;
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
  locked,
  overlayEditing = false,
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
  const origin = useRef({ x: image.x, y: image.y });
  const dragging = useRef(false);
  const pan = usePanResponder({
    onStartShouldSetPanResponderCapture: () => false,
    onStartShouldSetPanResponder: () => {
      if (overlayEditing) return false;
      if (layoutEditing && selected) return false;
      if (!locked) onDragStart(image.id);
      return true;
    },
    onMoveShouldSetPanResponderCapture: () =>
      !overlayEditing && dragging.current && !(layoutEditing && selected),
    onMoveShouldSetPanResponder: (_event, gesture) =>
      !overlayEditing &&
      !(layoutEditing && selected) &&
      !locked &&
      Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
    onPanResponderTerminationRequest: () => locked,
    onPanResponderGrant: (event) => {
      dragging.current = false;
      origin.current = { x: image.x, y: image.y };
      if (!locked) onDragStart(image.id);
      capturePointer(event);
    },
    onPanResponderMove: (_event, gesture) => {
      if (locked) return;
      if (Math.hypot(gesture.dx, gesture.dy) <= DRAG_THRESHOLD) return;
      dragging.current = true;
      const zoom = Math.max(scale, 0.01);
      onMove(image.id, origin.current.x + gesture.dx / zoom, origin.current.y + gesture.dy / zoom);
    },
    onPanResponderRelease: (event) => {
      releasePointer(event);
      if (!locked) onDragEnd(image.id);
      if (!dragging.current) onSelect(image.id);
      dragging.current = false;
    },
    onPanResponderTerminate: (event) => {
      releasePointer(event);
      if (!locked) onDragEnd(image.id);
      dragging.current = false;
    },
  });

  useEffect(() => {
    // While a drag is in flight `origin` stays frozen at the gesture's start; otherwise it
    // tracks the image's committed position. Readers are gesture handlers (post-commit).
    if (!dragging.current) origin.current = { x: image.x, y: image.y };
  }, [image.x, image.y]);

  const resizeOrigin = useRef({ width: image.width, height: image.height });
  const resizePan = usePanResponder({
    onStartShouldSetPanResponder: () => layoutEditing,
    onMoveShouldSetPanResponder: () => layoutEditing,
    onPanResponderGrant: () => {
      resizeOrigin.current = { width: image.width, height: image.height };
      onDragStart(image.id);
    },
    onPanResponderMove: (_event, gesture) => {
      const zoom = Math.max(scale, 0.01);
      const width = Math.max(80, resizeOrigin.current.width + gesture.dx / zoom);
      onResize(image.id, width, resizeOrigin.current.height * (width / resizeOrigin.current.width));
    },
    onPanResponderRelease: () => onDragEnd(image.id),
    onPanResponderTerminate: () => onDragEnd(image.id),
  });

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
    [colors, image.height, image.width, image.x, image.y, selected],
  );

  return (
    <View style={styles.image} {...pan.panHandlers}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="fill"
          // Hit-transparent: the image view owns the gesture, and on web a hittable <img>
          // would arm the native drag instead of the view's responder.
          pointerEvents="none"
        />
      ) : null}
      {layoutEditing && selected && (
        <>
          <TouchableOpacity
            style={[styles.actionButton, { right: 84 }]}
            onPress={() => onSendToBack(image.id)}
            accessibilityLabel="Send map image to back"
          >
            <Ionicons name="layers-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { right: 48 }]}
            onPress={() => onBringToFront(image.id)}
            accessibilityLabel="Bring map image to front"
          >
            <Ionicons name="layers" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { right: 12 }]}
            onPress={() => onToggleLock(image.id)}
            accessibilityLabel="Toggle map image lock"
          >
            <Ionicons
              name={locked ? 'lock-closed-outline' : 'lock-open-outline'}
              size={16}
              color={colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { left: 12 }]}
            onPress={() => onRemove(image.id)}
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

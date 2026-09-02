import { Ionicons } from '@expo/vector-icons';
import type { LocationMapMarkerType, LocationMapNodeType } from '@keres/shared';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../theme';
import { LOCATION_MAP_NODE_SIZE } from '@keres/shared/graphs/locationMapLayout';

const DRAG_THRESHOLD = 5;
const DESTINATION_HOLD_DURATION = 550;
/** The visual confirmation arrives precisely when release starts following the destination link. */
const DESTINATION_HOLD_HINT_DELAY = DESTINATION_HOLD_DURATION;

interface Props {
  node: Pick<
    LocationMapNodeType | LocationMapMarkerType,
    'id' | 'x' | 'y' | 'icon' | 'color' | 'zIndex' | 'destinationMapId'
  >;
  name: string;
  selected: boolean;
  layoutEditing: boolean;
  scale: number;
  /** Surface translation for the world-coordinate canvas. */
  positionOffsetX?: number;
  positionOffsetY?: number;
  onSelect: (nodeId: string) => void;
  onMove: (nodeId: string, x: number, y: number) => void;
  onDragStart: (nodeId: string) => void;
  onDragEnd: (nodeId: string) => void;
  onBringToFront: (nodeId: string) => void;
  onSendToBack: (nodeId: string) => void;
  onOpenDestination?: (nodeId: string) => void;
}

/**
 * A location or free marker on the map: a tappable, draggable circle with its icon and name.
 */
const LocationMapNodeView: React.FC<Props> = ({
  node,
  name,
  selected,
  layoutEditing,
  scale,
  positionOffsetX = 0,
  positionOffsetY = 0,
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
  onBringToFront,
  onSendToBack,
  onOpenDestination,
}) => {
  const { colors } = useTheme();
  const origin = useRef({ x: node.x + positionOffsetX, y: node.y + positionOffsetY });
  const dragging = useRef(false);
  const pressedAt = useRef(0);
  const destinationHoldHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDestinationHoldHint, setShowDestinationHoldHint] = useState(false);
  const nodeId = useRef(node.id);
  nodeId.current = node.id;
  const destinationMapId = useRef(node.destinationMapId);
  destinationMapId.current = node.destinationMapId;
  const position = useRef({ x: node.x + positionOffsetX, y: node.y + positionOffsetY });
  position.current = { x: node.x + positionOffsetX, y: node.y + positionOffsetY };
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const layoutEditingRef = useRef(layoutEditing);
  layoutEditingRef.current = layoutEditing;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const handlers = useRef({
    onSelect,
    onMove,
    onDragStart,
    onDragEnd,
    onBringToFront,
    onSendToBack,
    onOpenDestination,
  });
  handlers.current = {
    onSelect,
    onMove,
    onDragStart,
    onDragEnd,
    onBringToFront,
    onSendToBack,
    onOpenDestination,
  };

  const clearDestinationHoldHint = () => {
    if (destinationHoldHintTimer.current !== null) {
      clearTimeout(destinationHoldHintTimer.current);
      destinationHoldHintTimer.current = null;
    }
    setShowDestinationHoldHint(false);
  };

  useEffect(
    () => () => {
      if (destinationHoldHintTimer.current !== null) clearTimeout(destinationHoldHintTimer.current);
    },
    [],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => false,
        onStartShouldSetPanResponder: () => {
          if (layoutEditingRef.current && selectedRef.current) return false;
          handlers.current.onDragStart(nodeId.current);
          return true;
        },
        onMoveShouldSetPanResponderCapture: () =>
          dragging.current && !(layoutEditingRef.current && selectedRef.current),
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !(layoutEditingRef.current && selectedRef.current) &&
          Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          dragging.current = false;
          pressedAt.current = Date.now();
          origin.current = { x: position.current.x, y: position.current.y };
          handlers.current.onDragStart(nodeId.current);
          if (destinationMapId.current) {
            destinationHoldHintTimer.current = setTimeout(() => {
              destinationHoldHintTimer.current = null;
              setShowDestinationHoldHint(true);
            }, DESTINATION_HOLD_HINT_DELAY);
          }
          const pointerId = (event.nativeEvent as { pointerId?: number }).pointerId;
          const target = event.currentTarget as unknown as {
            setPointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.setPointerCapture?.(pointerId);
        },
        onPanResponderMove: (_event, gesture) => {
          if (Math.hypot(gesture.dx, gesture.dy) <= DRAG_THRESHOLD) return;
          clearDestinationHoldHint();
          dragging.current = true;
          const zoom = Math.max(scaleRef.current, 0.01);
          handlers.current.onMove(
            nodeId.current,
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
          handlers.current.onDragEnd(nodeId.current);
          clearDestinationHoldHint();
          if (!dragging.current) {
            // A regular tap always opens the point sheet. Holding a linked point is the deliberate
            // action that changes maps, which prevents an accidental map switch while editing.
            if (
              destinationMapId.current &&
              Date.now() - pressedAt.current >= DESTINATION_HOLD_DURATION
            )
              handlers.current.onOpenDestination?.(nodeId.current);
            else handlers.current.onSelect(nodeId.current);
          }
          dragging.current = false;
        },
        onPanResponderTerminate: (event) => {
          const pointerId = (event.nativeEvent as { pointerId?: number }).pointerId;
          const target = event.currentTarget as unknown as {
            releasePointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.releasePointerCapture?.(pointerId);
          handlers.current.onDragEnd(nodeId.current);
          clearDestinationHoldHint();
          dragging.current = false;
        },
      }),
    [],
  );

  if (!dragging.current)
    origin.current = { x: node.x + positionOffsetX, y: node.y + positionOffsetY };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        node: {
          position: 'absolute',
          left: node.x + positionOffsetX - LOCATION_MAP_NODE_SIZE / 2,
          top: node.y + positionOffsetY - LOCATION_MAP_NODE_SIZE / 2,
          width: LOCATION_MAP_NODE_SIZE,
          alignItems: 'center',
          zIndex: node.zIndex ?? 0,
          ...(Platform.OS === 'web'
            ? ({ userSelect: 'none', cursor: 'grab' } as Record<string, string>)
            : {}),
        },
        circle: {
          width: LOCATION_MAP_NODE_SIZE,
          height: LOCATION_MAP_NODE_SIZE,
          borderRadius: LOCATION_MAP_NODE_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: selected ? 2.5 : 1.5,
          borderColor: selected ? colors.primary : node.color,
        },
        label: {
          fontSize: Platform.OS === 'web' ? 10 : 12,
          fontWeight: '600',
          color: colors.text,
          textAlign: 'center',
          marginTop: 2,
          // On a touch map the full place name is more useful than a compact, ambiguous label.
          // The canvas permits overflowing labels, so mobile can wrap freely rather than hiding
          // the identifying end of a name behind an ellipsis.
          width: Platform.OS === 'web' ? undefined : 240,
          maxWidth: Platform.OS === 'web' ? 96 : 240,
          // A soft halo in the background colour, so the name stays readable over the image
          // bases - the same treatment the exported SVG gives it.
          textShadowColor: colors.background,
          textShadowRadius: 3,
          textShadowOffset: { width: 0, height: 0 },
        },
        layerButton: {
          position: 'absolute',
          top: -12,
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.primary,
          zIndex: 3,
        },
        destinationBadge: {
          position: 'absolute',
          right: -3,
          top: -3,
          width: 16,
          height: 16,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          borderWidth: 1,
          borderColor: colors.surface,
        },
        destinationHoldHint: {
          position: 'absolute',
          left: LOCATION_MAP_NODE_SIZE / 2 - 19,
          top: -46,
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          borderWidth: 2,
          borderColor: colors.surface,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
          zIndex: 4,
        },
      }),
    [colors, node.color, node.x, node.y, positionOffsetX, positionOffsetY, selected],
  );

  return (
    <View style={styles.node} {...pan.panHandlers}>
      <View style={styles.circle} pointerEvents="none">
        <Ionicons
          name={(node.icon as keyof typeof Ionicons.glyphMap) || 'location'}
          size={22}
          color={node.color}
        />
      </View>
      {!!node.destinationMapId && (
        <View pointerEvents="none" style={styles.destinationBadge}>
          <Ionicons name="open-outline" size={11} color={colors.surface} />
        </View>
      )}
      {showDestinationHoldHint && !!node.destinationMapId && (
        <View
          pointerEvents="none"
          testID={`location-map-destination-hold-hint-${node.id}`}
          style={styles.destinationHoldHint}
        >
          <Ionicons name="open-outline" size={22} color={colors.surface} />
        </View>
      )}
      {layoutEditing && selected && (
        <>
          <TouchableOpacity
            style={[styles.layerButton, { left: -12 }]}
            onPress={() => handlers.current.onSendToBack(nodeId.current)}
            accessibilityLabel="Send location point to back"
          >
            <Ionicons name="layers-outline" size={15} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.layerButton, { right: -12 }]}
            onPress={() => handlers.current.onBringToFront(nodeId.current)}
            accessibilityLabel="Bring location point to front"
          >
            <Ionicons name="layers" size={15} color={colors.primary} />
          </TouchableOpacity>
        </>
      )}
      <Text
        style={styles.label}
        numberOfLines={Platform.OS === 'web' ? 1 : undefined}
        pointerEvents="none"
      >
        {name}
      </Text>
    </View>
  );
};

export default React.memo(LocationMapNodeView);

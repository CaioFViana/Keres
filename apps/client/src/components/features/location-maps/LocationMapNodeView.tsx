import { Ionicons } from '@expo/vector-icons';
import type { LocationMapNodeType } from '@keres/shared';
import React, { useMemo, useRef } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';
import { LOCATION_MAP_NODE_SIZE } from '../../../utils/locationMapLayout';

const DRAG_THRESHOLD = 5;

interface Props {
  node: LocationMapNodeType;
  name: string;
  selected: boolean;
  scale: number;
  /** Surface translation for the world-coordinate canvas. */
  positionOffsetX?: number;
  positionOffsetY?: number;
  onSelect: (nodeId: string) => void;
  onMove: (nodeId: string, x: number, y: number) => void;
  onDragStart: (nodeId: string) => void;
  onDragEnd: (nodeId: string) => void;
}

/**
 * A location point on the map: a tappable, draggable circle with the location's icon and its
 * name underneath. The drag responder is the same pattern as the board's pin (`BoardNodeView`).
 */
const LocationMapNodeView: React.FC<Props> = ({
  node,
  name,
  selected,
  scale,
  positionOffsetX = 0,
  positionOffsetY = 0,
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
}) => {
  const { colors } = useTheme();
  const origin = useRef({ x: node.x + positionOffsetX, y: node.y + positionOffsetY });
  const dragging = useRef(false);
  const nodeId = useRef(node.id);
  nodeId.current = node.id;
  const position = useRef({ x: node.x + positionOffsetX, y: node.y + positionOffsetY });
  position.current = { x: node.x + positionOffsetX, y: node.y + positionOffsetY };
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const handlers = useRef({ onSelect, onMove, onDragStart, onDragEnd });
  handlers.current = { onSelect, onMove, onDragStart, onDragEnd };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => true,
        onStartShouldSetPanResponder: () => {
          handlers.current.onDragStart(nodeId.current);
          return true;
        },
        onMoveShouldSetPanResponderCapture: () => dragging.current,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          dragging.current = false;
          origin.current = { x: position.current.x, y: position.current.y };
          handlers.current.onDragStart(nodeId.current);
          const pointerId = (event.nativeEvent as { pointerId?: number }).pointerId;
          const target = event.currentTarget as unknown as {
            setPointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.setPointerCapture?.(pointerId);
        },
        onPanResponderMove: (_event, gesture) => {
          if (Math.hypot(gesture.dx, gesture.dy) <= DRAG_THRESHOLD) return;
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
          if (!dragging.current) handlers.current.onSelect(nodeId.current);
          dragging.current = false;
        },
        onPanResponderTerminate: (event) => {
          const pointerId = (event.nativeEvent as { pointerId?: number }).pointerId;
          const target = event.currentTarget as unknown as {
            releasePointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.releasePointerCapture?.(pointerId);
          handlers.current.onDragEnd(nodeId.current);
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

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
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
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
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
}) => {
  const { colors } = useTheme();
  const origin = useRef({ x: node.x, y: node.y });
  const dragging = useRef(false);
  const position = useRef({ x: node.x, y: node.y });
  position.current = { x: node.x, y: node.y };
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const handlers = useRef({ onSelect, onMove, onDragStart, onDragEnd });
  handlers.current = { onSelect, onMove, onDragStart, onDragEnd };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => true,
        onStartShouldSetPanResponder: () => {
          handlers.current.onDragStart();
          return true;
        },
        onMoveShouldSetPanResponderCapture: () => dragging.current,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          dragging.current = false;
          origin.current = { x: position.current.x, y: position.current.y };
          handlers.current.onDragStart();
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
          handlers.current.onDragEnd();
          if (!dragging.current) handlers.current.onSelect();
          dragging.current = false;
        },
        onPanResponderTerminate: (event) => {
          const pointerId = (event.nativeEvent as { pointerId?: number }).pointerId;
          const target = event.currentTarget as unknown as {
            releasePointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.releasePointerCapture?.(pointerId);
          handlers.current.onDragEnd();
          dragging.current = false;
        },
      }),
    [],
  );

  if (!dragging.current) origin.current = { x: node.x, y: node.y };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        node: {
          position: 'absolute',
          left: node.x - LOCATION_MAP_NODE_SIZE / 2,
          top: node.y - LOCATION_MAP_NODE_SIZE / 2,
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
          fontSize: 10,
          fontWeight: '600',
          color: colors.text,
          textAlign: 'center',
          marginTop: 2,
          maxWidth: 96,
        },
      }),
    [colors, node.color, node.x, node.y, selected],
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
      <Text style={styles.label} numberOfLines={1} pointerEvents="none">
        {name}
      </Text>
    </View>
  );
};

export default LocationMapNodeView;
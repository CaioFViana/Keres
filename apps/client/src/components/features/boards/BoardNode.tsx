import { Ionicons } from '@expo/vector-icons';
import type { BoardNodeType } from '@keres/shared';
import React, { useMemo, useRef } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';
import { boardPinAccent, boardPinIcon } from '../../../utils/boardPinAppearance';
import { BOARD_NODE_HEIGHT, BOARD_NODE_WIDTH } from '../../../utils/boardLayout';

const DRAG_THRESHOLD = 5;

interface Props {
  node: BoardNodeType;
  title: string;
  typeLabel: string;
  ghost?: boolean;
  selected: boolean;
  scale: number;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const BoardNodeView: React.FC<Props> = ({
  node,
  title,
  typeLabel,
  ghost,
  selected,
  scale,
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
}) => {
  const { colors } = useTheme();
  /**
   * The responder is created once. Recreating it on every parent render (each `onMove`) drops the
   * mouse on the web as soon as the pin leaves the original hit box.
   */
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
          left: node.x,
          top: node.y,
          width: BOARD_NODE_WIDTH,
          height: BOARD_NODE_HEIGHT,
          borderRadius: 10,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: node.kind === 'note' ? colors.primaryContainer : colors.surface,
          opacity: ghost ? 0.7 : 1,
          paddingLeft: 12,
          paddingRight: 8,
          paddingVertical: 8,
          justifyContent: 'center',
          overflow: 'hidden',
          ...(Platform.OS === 'web'
            ? ({ userSelect: 'none', cursor: 'grab' } as Record<string, string>)
            : {}),
        },
        stripe: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          backgroundColor: boardPinAccent(
            node.kind,
            node.kind === 'entity' ? node.entityType : undefined,
          ),
        },
        row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        title: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.text },
        typeLabel: { fontSize: 10, fontWeight: '600', marginTop: 3, textTransform: 'uppercase' },
      }),
    [colors, ghost, node, selected],
  );

  const accent = boardPinAccent(node.kind, node.kind === 'entity' ? node.entityType : undefined);
  const icon = boardPinIcon(
    node.kind,
    node.kind === 'entity' ? node.entityType : undefined,
  ) as keyof typeof Ionicons.glyphMap;

  return (
    <View style={styles.node} {...pan.panHandlers}>
      <View style={styles.stripe} pointerEvents="none" />
      <View pointerEvents="none">
        <View style={styles.row}>
          <Ionicons
            name={icon}
            size={16}
            color={accent}
          />
          <Text style={styles.title} numberOfLines={1} selectable={false}>
            {title}
          </Text>
        </View>
        <Text
          style={[
            styles.typeLabel,
            { color: ghost ? colors.error : colors.textSecondary },
          ]}
          numberOfLines={1}
          selectable={false}
        >
          {typeLabel}
        </Text>
      </View>
    </View>
  );
};

export default BoardNodeView;

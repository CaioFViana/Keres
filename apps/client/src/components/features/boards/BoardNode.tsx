import { Ionicons } from '@expo/vector-icons';
import type { BoardNodeType, BoardPinEntity } from '@keres/shared';
import React, { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';
import { BOARD_NODE_HEIGHT, BOARD_NODE_WIDTH } from '../../../utils/boardLayout';

const PIN_ICONS: Record<BoardPinEntity, keyof typeof Ionicons.glyphMap> = {
  Character: 'person-outline',
  Location: 'location-outline',
  Note: 'document-text-outline',
  Scene: 'film-outline',
  Item: 'cube-outline',
  Gallery: 'images-outline',
  Chapter: 'book-outline',
};

const DRAG_THRESHOLD = 5;

interface Props {
  node: BoardNodeType;
  title: string;
  subtitle?: string;
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
  subtitle,
  ghost,
  selected,
  scale,
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
}) => {
  const { colors } = useTheme();
  const origin = useRef({ x: node.x, y: node.y });
  origin.current = { x: node.x, y: node.y };
  const dragging = useRef(false);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
        onPanResponderGrant: () => {
          dragging.current = false;
          onDragStart();
        },
        onPanResponderMove: (_event, gesture) => {
          if (Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD) dragging.current = true;
          onMove(
            origin.current.x + gesture.dx / Math.max(scale, 0.01),
            origin.current.y + gesture.dy / Math.max(scale, 0.01),
          );
        },
        onPanResponderRelease: () => {
          onDragEnd();
          if (!dragging.current) onSelect();
        },
        onPanResponderTerminate: () => {
          onDragEnd();
        },
      }),
    [onDragEnd, onDragStart, onMove, onSelect, scale],
  );

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
          paddingHorizontal: 8,
          paddingVertical: 8,
          justifyContent: 'center',
        },
        row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        title: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.text },
        subtitle: { fontSize: 10, color: colors.textSecondary, marginTop: 3 },
      }),
    [colors, ghost, node.kind, node.x, node.y, selected],
  );

  const icon =
    node.kind === 'note' ? 'create-outline' : PIN_ICONS[node.entityType] ?? 'ellipse-outline';

  return (
    <View style={styles.node} {...pan.panHandlers}>
      <View style={styles.row}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      </View>
      {!!subtitle && (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
  );
};

export default BoardNodeView;

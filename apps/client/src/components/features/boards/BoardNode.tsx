import { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance, type BoardNodeType } from '@keres/shared';
import React, { useMemo, useRef } from 'react';
import { Image, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';
import { useResolvedMediaUri } from '../../../hooks/useResolvedMediaUri';
import { boardPinAppearanceType } from '../../../utils/boardPinAppearance';
import {
  boardNodeSize,
  galleryHasImage,
  BOARD_GALLERY_IMAGE_HEIGHT,
  BOARD_NOTE_BODY_MAX_LINES,
  type BoardGalleryMedia,
} from '../../../utils/boardLayout';

const DRAG_THRESHOLD = 5;

interface Props {
  node: BoardNodeType;
  title: string;
  typeLabel: string;
  appearanceType?: string;
  ghost?: boolean;
  selected: boolean;
  scale: number;
  /** Surface translation for the world-coordinate canvas. */
  positionOffsetX?: number;
  positionOffsetY?: number;
  /** The gallery's media, when this is a Gallery pin - decides whether the card shows its image. */
  galleryMedia?: BoardGalleryMedia | null;
  onSelect: (node: BoardNodeType) => void;
  onMove: (nodeId: string, x: number, y: number) => void;
  onDragStart: (nodeId: string) => void;
  onDragEnd: (nodeId: string) => void;
}

const BoardNodeView: React.FC<Props> = ({
  node,
  title,
  typeLabel,
  appearanceType,
  ghost,
  selected,
  scale,
  positionOffsetX = 0,
  positionOffsetY = 0,
  galleryMedia,
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
  const origin = useRef({ x: node.x + positionOffsetX, y: node.y + positionOffsetY });
  const dragging = useRef(false);
  const nodeRef = useRef(node);
  nodeRef.current = node;
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
          if (!dragging.current) handlers.current.onSelect(nodeRef.current);
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

  const hasGalleryImage =
    node.kind === 'entity' && node.entityType === 'Gallery' && galleryHasImage(galleryMedia);
  const galleryImagePath =
    hasGalleryImage && galleryMedia
      ? galleryMedia.mediaType === 'image'
        ? galleryMedia.localPath
        : galleryMedia.thumbnailPath
      : null;
  const resolvedGalleryUri = useResolvedMediaUri(galleryImagePath);
  const size = boardNodeSize(node, galleryMedia);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        node: {
          position: 'absolute',
          left: node.x + positionOffsetX,
          top: node.y + positionOffsetY,
          width: size.width,
          height: size.height,
          borderRadius: 10,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: node.kind === 'note' ? colors.primaryContainer : colors.surface,
          opacity: ghost ? 0.7 : 1,
          paddingLeft: 12,
          paddingRight: 8,
          paddingVertical: 8,
          justifyContent: hasGalleryImage ? 'flex-start' : 'center',
          overflow: 'hidden',
          ...(Platform.OS === 'web'
            ? ({ userSelect: 'none', cursor: 'grab' } as Record<string, string>)
            : {}),
        },
        galleryImage: {
          width: '100%',
          height: BOARD_GALLERY_IMAGE_HEIGHT,
          backgroundColor: colors.surface,
        },
        galleryInfo: { paddingTop: 8 },
        stripe: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
        },
        row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        title: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.text },
        typeLabel: { fontSize: 10, fontWeight: '600', marginTop: 3, textTransform: 'uppercase' },
        body: { fontSize: 11, color: colors.text, marginTop: 6, lineHeight: 14 },
      }),
    [colors, ghost, hasGalleryImage, node, positionOffsetX, positionOffsetY, selected, size],
  );

  const appearance = getEntityAppearance(
    appearanceType ??
      boardPinAppearanceType(node.kind, node.kind === 'entity' ? node.entityType : undefined),
  );
  const accent = appearance.color;
  const icon = appearance.icon as keyof typeof Ionicons.glyphMap;

  return (
    <View style={styles.node} {...pan.panHandlers}>
      {hasGalleryImage ? (
        <>
          <Image
            source={resolvedGalleryUri ? { uri: resolvedGalleryUri } : undefined}
            style={styles.galleryImage}
            resizeMode="cover"
          />
          <View style={styles.galleryInfo} pointerEvents="none">
            <View style={styles.row}>
              <Ionicons name={icon} size={16} color={accent} />
              <Text style={styles.title} numberOfLines={1} selectable={false}>
                {title}
              </Text>
            </View>
            <Text
              style={[styles.typeLabel, { color: ghost ? colors.error : colors.textSecondary }]}
              numberOfLines={1}
              selectable={false}
            >
              {typeLabel}
            </Text>
          </View>
        </>
      ) : (
        <>
          <View style={[styles.stripe, { backgroundColor: accent }]} pointerEvents="none" />
          <View pointerEvents="none">
            <View style={styles.row}>
              <Ionicons name={icon} size={16} color={accent} />
              <Text style={styles.title} numberOfLines={1} selectable={false}>
                {title}
              </Text>
            </View>
            <Text
              style={[styles.typeLabel, { color: ghost ? colors.error : colors.textSecondary }]}
              numberOfLines={1}
              selectable={false}
            >
              {typeLabel}
            </Text>
            {node.kind === 'note' && !!node.body && (
              <Text
                style={styles.body}
                numberOfLines={BOARD_NOTE_BODY_MAX_LINES}
                selectable={false}
              >
                {node.body}
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );
};

export default React.memo(BoardNodeView);

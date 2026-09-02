import { Ionicons } from '@expo/vector-icons';
import type { BoardNodeType } from '@keres/shared';
import React, { useMemo, useRef } from 'react';
import {
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../../theme';
import { useResolvedMediaUri } from '../../../hooks/useResolvedMediaUri';
import { getBoardPinAppearance, type BoardCardAppearance } from '../../../utils/boardPinAppearance';
import {
  boardNodeSize,
  galleryHasImage,
  BOARD_GALLERY_IMAGE_HEIGHT,
  BOARD_NOTE_BODY_MAX_LINES,
  type BoardGalleryMedia,
} from '../../../utils/boardLayout';
import type { BoardEntitySummary } from '../../../utils/boardEntitySummary';

const DRAG_THRESHOLD = 5;

interface Props {
  node: BoardNodeType;
  title: string;
  typeLabel: string;
  appearanceType?: string;
  appearance?: BoardCardAppearance;
  ghost?: boolean;
  selected: boolean;
  layoutEditing: boolean;
  connectionMode: boolean;
  scale: number;
  /** Surface translation for the world-coordinate canvas. */
  positionOffsetX?: number;
  positionOffsetY?: number;
  /** The gallery's media, when this is a Gallery pin - decides whether the card shows its image. */
  galleryMedia?: BoardGalleryMedia | null;
  summary?: BoardEntitySummary | null;
  onSelect: (node: BoardNodeType) => void;
  onMove: (nodeId: string, x: number, y: number) => void;
  onResize: (nodeId: string, width: number, height: number) => void;
  onDragStart: (nodeId: string) => void;
  onDragEnd: (nodeId: string) => void;
  onOpenDetails: (node: BoardNodeType) => void;
  onBringToFront: (nodeId: string) => void;
  onSendToBack: (nodeId: string) => void;
  onConnectionStart: (node: BoardNodeType) => void;
  onConnectionMove: (nodeId: string, dx: number, dy: number) => void;
  onConnectionEnd: (nodeId: string, dx: number, dy: number) => void;
  onConnectionCancel: () => void;
}

const BoardNodeView: React.FC<Props> = ({
  node,
  title,
  typeLabel,
  appearanceType,
  appearance,
  ghost,
  selected,
  layoutEditing,
  connectionMode,
  scale,
  positionOffsetX = 0,
  positionOffsetY = 0,
  galleryMedia,
  summary,
  onSelect,
  onMove,
  onResize,
  onDragStart,
  onDragEnd,
  onOpenDetails,
  onBringToFront,
  onSendToBack,
  onConnectionStart,
  onConnectionMove,
  onConnectionEnd,
  onConnectionCancel,
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
  const layoutEditingRef = useRef(layoutEditing);
  layoutEditingRef.current = layoutEditing;
  const connectionModeRef = useRef(connectionMode);
  connectionModeRef.current = connectionMode;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const handlers = useRef({
    onSelect,
    onMove,
    onResize,
    onDragStart,
    onDragEnd,
    onOpenDetails,
    onBringToFront,
    onSendToBack,
    onConnectionStart,
    onConnectionMove,
    onConnectionEnd,
    onConnectionCancel,
  });
  handlers.current = {
    onSelect,
    onMove,
    onResize,
    onDragStart,
    onDragEnd,
    onOpenDetails,
    onBringToFront,
    onSendToBack,
    onConnectionStart,
    onConnectionMove,
    onConnectionEnd,
    onConnectionCancel,
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => false,
        // A selected card in layout mode exposes real controls inside itself. Let those controls
        // own the gesture; otherwise the parent responder steals a resize after a rerender.
        onStartShouldSetPanResponder: () => {
          if (connectionModeRef.current) return true;
          if (layoutEditingRef.current && selectedRef.current) return false;
          handlers.current.onDragStart(nodeId.current);
          return true;
        },
        onMoveShouldSetPanResponderCapture: () =>
          (dragging.current || connectionModeRef.current) &&
          !(layoutEditingRef.current && selectedRef.current),
        onMoveShouldSetPanResponder: (_event, gesture) =>
          (connectionModeRef.current || !(layoutEditingRef.current && selectedRef.current)) &&
          Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          dragging.current = false;
          origin.current = { x: position.current.x, y: position.current.y };
          if (connectionModeRef.current) handlers.current.onConnectionStart(nodeRef.current);
          else handlers.current.onDragStart(nodeId.current);
          const pointerId = (event.nativeEvent as { pointerId?: number }).pointerId;
          const target = event.currentTarget as unknown as {
            setPointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.setPointerCapture?.(pointerId);
        },
        onPanResponderMove: (_event, gesture) => {
          const zoom = Math.max(scaleRef.current, 0.01);
          if (connectionModeRef.current) {
            handlers.current.onConnectionMove(nodeId.current, gesture.dx / zoom, gesture.dy / zoom);
            return;
          }
          if (Math.hypot(gesture.dx, gesture.dy) <= DRAG_THRESHOLD) return;
          dragging.current = true;
          handlers.current.onMove(
            nodeId.current,
            origin.current.x + gesture.dx / zoom,
            origin.current.y + gesture.dy / zoom,
          );
        },
        onPanResponderRelease: (event, gesture) => {
          const pointerId = (event.nativeEvent as { pointerId?: number }).pointerId;
          const target = event.currentTarget as unknown as {
            releasePointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.releasePointerCapture?.(pointerId);
          if (connectionModeRef.current) {
            const zoom = Math.max(scaleRef.current, 0.01);
            handlers.current.onConnectionEnd(nodeId.current, gesture.dx / zoom, gesture.dy / zoom);
            dragging.current = false;
            return;
          }
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
          if (connectionModeRef.current) handlers.current.onConnectionCancel();
          else handlers.current.onDragEnd(nodeId.current);
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
  const showSummary =
    node.kind === 'entity' &&
    (node.displayMode === 'summary' || node.displayMode === 'summary-and-note') &&
    !!summary?.details;
  const showCardNote =
    node.kind === 'entity' &&
    (node.displayMode === 'note' || node.displayMode === 'summary-and-note') &&
    !!node.cardNote;
  const detailLines = Math.max(2, Math.floor((size.height - (hasGalleryImage ? 180 : 66)) / 18));
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const resizeOrigin = useRef(size);
  const resizePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => layoutEditing,
        onMoveShouldSetPanResponder: () => layoutEditing,
        onPanResponderGrant: () => {
          resizeOrigin.current = sizeRef.current;
          handlers.current.onDragStart(nodeId.current);
        },
        onPanResponderMove: (_event, gesture) => {
          const zoom = Math.max(scaleRef.current, 0.01);
          handlers.current.onResize(
            nodeId.current,
            resizeOrigin.current.width + gesture.dx / zoom,
            resizeOrigin.current.height + gesture.dy / zoom,
          );
        },
        onPanResponderRelease: () => handlers.current.onDragEnd(nodeId.current),
        onPanResponderTerminate: () => handlers.current.onDragEnd(nodeId.current),
      }),
    [layoutEditing],
  );

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
          zIndex: node.zIndex ?? 0,
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
        title: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
        typeLabel: { fontSize: 11, fontWeight: '600', marginTop: 3, textTransform: 'uppercase' },
        body: { fontSize: 15, color: colors.text, marginTop: 6, lineHeight: 18 },
        cardNote: { fontSize: 15, color: colors.textSecondary, marginTop: 5, lineHeight: 18 },
        resizeHandle: {
          position: 'absolute',
          right: 3,
          bottom: 3,
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          borderWidth: 2,
          borderColor: colors.surface,
          zIndex: 2,
        },
        detailsButton: {
          position: 'absolute',
          right: 6,
          top: 6,
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.primary,
          zIndex: 2,
        },
        layerFrontButton: {
          position: 'absolute',
          right: 38,
          top: 6,
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.primary,
          zIndex: 2,
        },
        layerBackButton: {
          position: 'absolute',
          right: 70,
          top: 6,
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.primary,
          zIndex: 2,
        },
      }),
    [colors, ghost, hasGalleryImage, node, positionOffsetX, positionOffsetY, selected, size],
  );

  const cardAppearance =
    appearance ??
    getBoardPinAppearance(
      node.kind,
      node.kind === 'entity' ? node.entityType : undefined,
      appearanceType === 'Event' ? 'event' : undefined,
    );
  const accent = cardAppearance.color;
  const icon = cardAppearance.icon as keyof typeof Ionicons.glyphMap;

  return (
    <View style={styles.node} {...pan.panHandlers}>
      {layoutEditing && selected && (
        <>
          <TouchableOpacity
            style={styles.layerBackButton}
            onPress={() => handlers.current.onSendToBack(nodeId.current)}
            accessibilityRole="button"
            accessibilityLabel="Send board card to back"
          >
            <Ionicons name="layers-outline" size={15} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.layerFrontButton}
            onPress={() => handlers.current.onBringToFront(nodeId.current)}
            accessibilityRole="button"
            accessibilityLabel="Bring board card to front"
          >
            <Ionicons name="layers" size={15} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => handlers.current.onOpenDetails(nodeRef.current)}
            accessibilityRole="button"
            accessibilityLabel="Open board card details"
          >
            <Ionicons name="information-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
          <View
            style={styles.resizeHandle}
            {...resizePan.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="Resize board card"
          >
            <Ionicons name="expand-outline" size={14} color={colors.onPrimary} />
          </View>
        </>
      )}
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
            {showSummary && (
              <Text style={styles.body} numberOfLines={detailLines} selectable={false}>
                {summary?.details}
              </Text>
            )}
            {showCardNote && (
              <Text style={styles.cardNote} numberOfLines={detailLines} selectable={false}>
                {node.cardNote}
              </Text>
            )}
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
            {showSummary && (
              <Text style={styles.body} numberOfLines={detailLines} selectable={false}>
                {summary?.details}
              </Text>
            )}
            {showCardNote && (
              <Text style={styles.cardNote} numberOfLines={detailLines} selectable={false}>
                {node.cardNote}
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );
};

export default React.memo(BoardNodeView);

import { Ionicons } from '@expo/vector-icons';
import {
  canvasOverlayBounds,
  type CanvasOverlayType,
  type SpatialPoint,
} from '@keres/shared';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';

interface OverlaySelectionViewProps {
  overlay: CanvasOverlayType;
  scale: number;
  onDragStart: () => void;
  onDragEnd: () => void;
  onCommitMove: (id: string, dx: number, dy: number) => void;
  onCommitVertex: (id: string, index: number, point: SpatialPoint) => void;
  onCommitRect: (id: string, rect: { x: number; y: number; width: number; height: number }) => void;
  onDetails: (id: string) => void;
  onMoveLayer: (id: string, direction: 'front' | 'back') => void;
  onDeselect: () => void;
}

const HANDLE_SCREEN = 18;
const MIN_RECT_WORLD = 8;

type Corner = 0 | 1 | 2 | 3;

/**
 * Native editing chrome for the selected overlay: a dashed bounds box, a move badge, vertex
 * handles (line/polygon), corner handles (frame/shape) and the action column (details,
 * raise, lower, deselect - the node layout chrome, minus resize). The box itself is
 * touch-transparent so taps fall through to the nodes below; only the badge, handles
 * and buttons capture. Transient drag state stays local and commits on release.
 */
const OverlaySelectionView: React.FC<OverlaySelectionViewProps> = ({
  overlay,
  scale,
  onDragStart,
  onDragEnd,
  onCommitMove,
  onCommitVertex,
  onCommitRect,
  onDetails,
  onMoveLayer,
  onDeselect,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bounds = canvasOverlayBounds(overlay);
  const pad = HANDLE_SCREEN / scale;
  const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0 });
  const moveTotal = useRef({ x: 0, y: 0 });
  const callbacks = useRef({ onDragStart, onDragEnd, onCommitMove });
  useEffect(() => {
    // Latest-ref sync for the responder below: every reader runs on gestures, after effects
    // have flushed. No dependency array - the sync unconditionally followed every render.
    callbacks.current = { onDragStart, onDragEnd, onCommitMove };
  });

  const moveResponder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- handlers touch refs only on gestures; create wires them without invoking any during render.
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          moveTotal.current = { x: 0, y: 0 };
          setMoveOffset({ x: 0, y: 0 });
          callbacks.current.onDragStart();
        },
        onPanResponderMove: (_, gesture) => {
          const offset = { x: gesture.dx / scale, y: gesture.dy / scale };
          moveTotal.current = offset;
          setMoveOffset(offset);
        },
        onPanResponderRelease: () => {
          callbacks.current.onCommitMove(overlay.id, moveTotal.current.x, moveTotal.current.y);
          setMoveOffset({ x: 0, y: 0 });
          callbacks.current.onDragEnd();
        },
        onPanResponderTerminate: () => {
          setMoveOffset({ x: 0, y: 0 });
          callbacks.current.onDragEnd();
        },
      }),
    [overlay.id, scale],
  );

  const vertices =
    overlay.kind === 'line' || overlay.kind === 'polygon' ? overlay.points : null;
  const rect = overlay.kind === 'frame' || overlay.kind === 'shape' ? overlay : null;
  const handle = HANDLE_SCREEN / scale;
  const styles = StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: bounds.x - pad,
      top: bounds.y - pad,
      width: bounds.width + pad * 2,
      height: bounds.height + pad * 2,
      transform: [{ translateX: moveOffset.x * scale }, { translateY: moveOffset.y * scale }],
    },
    box: {
      position: 'absolute',
      left: pad,
      top: pad,
      width: bounds.width,
      height: bounds.height,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.primary,
    },
    moveBadge: {
      position: 'absolute',
      left: -handle / 2,
      top: -handle / 2,
      width: handle + 8,
      height: handle + 8,
      borderRadius: (handle + 8) / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    chromeButton: {
      position: 'absolute',
      right: -handle / 2,
      width: handle + 8,
      height: handle + 8,
      borderRadius: (handle + 8) / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
  });

  const chromeButtons = (
    [
      { testID: 'overlay-chrome-deselect', icon: 'close', label: t('overlay_deselect'), onPress: onDeselect },
      { testID: 'overlay-chrome-details', icon: 'create-outline', label: t('overlay_edit_details'), onPress: () => onDetails(overlay.id) },
      { testID: 'overlay-chrome-raise', icon: 'layers', label: t('overlay_bring_to_front'), onPress: () => onMoveLayer(overlay.id, 'front') },
      { testID: 'overlay-chrome-lower', icon: 'layers-outline', label: t('overlay_send_to_back'), onPress: () => onMoveLayer(overlay.id, 'back') },
    ] as const
  ).map((button, index) => (
    <TouchableOpacity
      key={button.testID}
      testID={button.testID}
      accessibilityRole="button"
      accessibilityLabel={button.label}
      onPress={button.onPress}
      style={[styles.chromeButton, { top: -handle / 2 + index * (handle + 14) }]}
    >
      <Ionicons name={button.icon} size={handle * 0.7} color={colors.primary} />
    </TouchableOpacity>
  ));

  return (
    <View testID="overlay-selection" style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.box} pointerEvents="none" />
      <View testID="overlay-move" style={styles.moveBadge} {...moveResponder.panHandlers}>
        <Ionicons name="move" size={handle * 0.7} color={colors.surface} />
      </View>
      {chromeButtons}
      {vertices?.map((point, index) => (
        <DragHandle
          key={index}
          testID={`overlay-vertex-${index}`}
          x={point.x - bounds.x + pad - handle / 2}
          y={point.y - bounds.y + pad - handle / 2}
          size={handle}
          round
          borderColor={colors.primary}
          fillColor={colors.surface}
          scale={scale}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onCommit={(dx, dy) =>
            onCommitVertex(overlay.id, index, { x: point.x + dx, y: point.y + dy })
          }
        />
      ))}
      {rect &&
        ([
          [rect.x, rect.y],
          [rect.x + rect.width, rect.y],
          [rect.x + rect.width, rect.y + rect.height],
          [rect.x, rect.y + rect.height],
        ] as const).map(([cornerX, cornerY], index) => (
          <DragHandle
            key={index}
            testID={`overlay-corner-${index}`}
            x={cornerX - bounds.x + pad - handle / 2}
            y={cornerY - bounds.y + pad - handle / 2}
            size={handle}
            round={false}
            borderColor={colors.primary}
            fillColor={colors.surface}
            scale={scale}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onCommit={(dx, dy) =>
              onCommitRect(overlay.id, movedCorner(rect, index as Corner, dx, dy))
            }
          />
        ))}
    </View>
  );
};

export default OverlaySelectionView;

function movedCorner(
  rect: { x: number; y: number; width: number; height: number },
  corner: Corner,
  dx: number,
  dy: number,
): { x: number; y: number; width: number; height: number } {
  const left = corner === 0 || corner === 3 ? rect.x + dx : rect.x;
  const top = corner === 0 || corner === 1 ? rect.y + dy : rect.y;
  const right = corner === 1 || corner === 2 ? rect.x + rect.width + dx : rect.x + rect.width;
  const bottom = corner === 2 || corner === 3 ? rect.y + rect.height + dy : rect.y + rect.height;
  const x = Math.min(left, right);
  const y = Math.min(top, bottom);
  return {
    x,
    y,
    width: Math.max(MIN_RECT_WORLD, Math.abs(right - left)),
    height: Math.max(MIN_RECT_WORLD, Math.abs(bottom - top)),
  };
}

function DragHandle({
  testID,
  x,
  y,
  size,
  round,
  borderColor,
  fillColor,
  scale,
  onDragStart,
  onDragEnd,
  onCommit,
}: {
  testID: string;
  x: number;
  y: number;
  size: number;
  round: boolean;
  borderColor: string;
  fillColor: string;
  scale: number;
  onDragStart: () => void;
  onDragEnd: () => void;
  onCommit: (dx: number, dy: number) => void;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const total = useRef({ x: 0, y: 0 });
  const callbacks = useRef({ onDragStart, onDragEnd, onCommit });
  useEffect(() => {
    // Latest-ref sync for the responder below: every reader runs on gestures, after effects
    // have flushed. No dependency array - the sync unconditionally followed every render.
    callbacks.current = { onDragStart, onDragEnd, onCommit };
  });
  const responder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- handlers touch refs only on gestures; create wires them without invoking any during render.
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          total.current = { x: 0, y: 0 };
          setOffset({ x: 0, y: 0 });
          callbacks.current.onDragStart();
        },
        onPanResponderMove: (_, gesture) => {
          const next = { x: gesture.dx / scale, y: gesture.dy / scale };
          total.current = next;
          setOffset(next);
        },
        onPanResponderRelease: () => {
          callbacks.current.onCommit(total.current.x, total.current.y);
          setOffset({ x: 0, y: 0 });
          callbacks.current.onDragEnd();
        },
        onPanResponderTerminate: () => {
          setOffset({ x: 0, y: 0 });
          callbacks.current.onDragEnd();
        },
      }),
    [scale],
  );
  return (
    <View
      testID={testID}
      style={{
        position: 'absolute',
        left: x + offset.x * scale,
        top: y + offset.y * scale,
        width: size,
        height: size,
        borderRadius: round ? size / 2 : 3,
        backgroundColor: fillColor,
        borderWidth: 2,
        borderColor,
      }}
      {...responder.panHandlers}
    />
  );
}

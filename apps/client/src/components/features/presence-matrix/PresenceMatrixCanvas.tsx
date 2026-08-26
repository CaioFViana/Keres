import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import CanvasLine from '../graphs/CanvasLine/CanvasLine';
import GraphCanvasFrame from '../graphs/GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '../../../hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '../../../hooks/usePanZoomCanvas';
import { useTheme } from '../../../theme';
import type { PresenceMatrixLayout } from '@keres/shared/graphs/presenceMatrixLayout';
import {
  buildMatrixThreadSegments,
  MATRIX_CELL_INSET,
  MATRIX_HEADER_HEIGHT,
  MATRIX_LABEL_WIDTH,
  MATRIX_PADDING,
  MATRIX_ROW_HEIGHT,
  MATRIX_THREAD_OPACITY,
  MATRIX_THREAD_WIDTH,
  matrixRowCenterY,
} from '@keres/shared/graphs/presenceMatrixLayout';

interface Props {
  layout: PresenceMatrixLayout;
  onPressScene: (sceneId: string) => void;
  onPressRow: (rowId: string) => void;
  showRowCoverage: boolean;
}
export type PresenceMatrixCanvasHandle = PanZoomCanvasHandle;

const PresenceMatrixCanvas = forwardRef<PresenceMatrixCanvasHandle, Props>(
  ({ layout, onPressScene, onPressRow, showRowCoverage }, ref) => {
    const { colors } = useTheme();
    const gridTop = MATRIX_PADDING + MATRIX_HEADER_HEIGHT;
    const gridLeft = MATRIX_PADDING + MATRIX_LABEL_WIDTH;
    /**
     * Every point of the drawing means something, so every point answers: the label band opens the
     * series, and the rest of a column opens that column's scene - a series is only present in a few
     * scenes, and the rest of the grid had nothing for the finger to land on. Hit-tested here instead
     * of layered with touch targets, which would take the responder and leave the pinch dead (see
     * `onTap`).
     */
    const handleTap = useCallback(
      (point: { x: number; y: number }) => {
        const rowIndex = Math.floor((point.y - gridTop) / MATRIX_ROW_HEIGHT);
        const row = point.y >= gridTop && rowIndex >= 0 ? layout.rows[rowIndex] : undefined;
        if (row && point.x < gridLeft) {
          onPressRow(row.id);
          return;
        }
        const sceneIndex = Math.floor((point.x - gridLeft) / layout.sceneWidth);
        const scene = point.x >= gridLeft ? layout.scenes[sceneIndex] : undefined;
        if (scene && point.y >= MATRIX_PADDING) onPressScene(scene.id);
      },
      [gridLeft, gridTop, layout.rows, layout.sceneWidth, layout.scenes, onPressRow, onPressScene],
    );
    const panZoom = usePanZoomCanvas(ref, layout, {
      minScale: 0.08,
      maxScale: 3,
      fitVerticalAlignment: 'top',
      refitOnLayoutChange: false,
      onTap: handleTap,
    });
    const styles = useMemo(
      () =>
        StyleSheet.create({
          label: {
            position: 'absolute',
            left: MATRIX_PADDING,
            width: MATRIX_LABEL_WIDTH - 8,
            fontSize: 12,
            fontWeight: '700',
            textAlignVertical: 'center',
          },
          rowPresence: { fontSize: 10, marginTop: 2 },
          column: { position: 'absolute', borderWidth: 0.5 },
          cell: {
            position: 'absolute',
            borderRadius: 7,
            borderWidth: 1,
            padding: 6,
            justifyContent: 'center',
          },
          cellText: { fontSize: 10, fontWeight: '600' },
        }),
      [],
    );
    const chapterGroups = useMemo(() => {
      const groups: { name: string; color: string; start: number; end: number }[] = [];
      layout.scenes.forEach((scene, index) => {
        const last = groups.at(-1);
        if (last && last.name === scene.chapterName) last.end = index;
        else
          groups.push({
            name: scene.chapterName,
            color: scene.chapterColor,
            start: index,
            end: index,
          });
      });
      return groups;
    }, [layout.scenes]);
    const threads = useMemo(
      () =>
        layout.rows.flatMap((row, rowIndex) =>
          buildMatrixThreadSegments(row, layout.scenes, layout.sceneWidth).map(
            (segment, position) => ({
              key: `${row.id}-${position}`,
              color: row.color,
              y: matrixRowCenterY(rowIndex),
              ...segment,
            }),
          ),
        ),
      [layout.rows, layout.sceneWidth, layout.scenes],
    );
    const gridHeight = layout.rows.length * MATRIX_ROW_HEIGHT;
    return (
      <GraphCanvasFrame width={layout.width} height={layout.height} {...panZoom}>
        {layout.scenes.map((scene, index) => {
          const x = MATRIX_PADDING + MATRIX_LABEL_WIDTH + index * layout.sceneWidth;
          return (
            <React.Fragment key={scene.id}>
              <View
                style={[
                  styles.column,
                  {
                    left: x,
                    top: gridTop,
                    width: layout.sceneWidth,
                    height: gridHeight,
                    backgroundColor: index % 2 ? colors.surface : colors.background,
                    borderColor: colors.border,
                  },
                ]}
              />
              <View
                style={{
                  position: 'absolute',
                  left: x,
                  top: gridTop - 6,
                  width: layout.sceneWidth,
                  height: 4,
                  backgroundColor: scene.chapterColor,
                }}
              />
            </React.Fragment>
          );
        })}
        {threads.map((thread) => (
          <CanvasLine
            key={thread.key}
            left={thread.x1}
            top={thread.y - MATRIX_THREAD_WIDTH / 2}
            length={thread.x2 - thread.x1}
            thickness={MATRIX_THREAD_WIDTH}
            color={thread.color}
            opacity={MATRIX_THREAD_OPACITY}
            dashed={thread.isGap}
          />
        ))}
        {chapterGroups.map((chapter) => (
          <View
            key={`${chapter.start}-${chapter.name}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: MATRIX_PADDING + MATRIX_LABEL_WIDTH + chapter.start * layout.sceneWidth + 5,
              top: MATRIX_PADDING,
              width: (chapter.end - chapter.start + 1) * layout.sceneWidth - 10,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700' }}
            >
              {chapter.name}
            </Text>
          </View>
        ))}
        {layout.scenes.map((scene, index) => (
          <View
            key={`scene-${scene.id}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: MATRIX_PADDING + MATRIX_LABEL_WIDTH + index * layout.sceneWidth + 4,
              top: MATRIX_PADDING + 17,
              width: layout.sceneWidth - 8,
              height: MATRIX_HEADER_HEIGHT - 25,
              justifyContent: 'center',
            }}
          >
            <Text
              numberOfLines={2}
              style={[
                styles.label,
                {
                  position: 'relative',
                  left: 4,
                  width: layout.sceneWidth - 12,
                  color: colors.text,
                  fontSize: 10,
                },
              ]}
            >
              {`${index + 1}. ${scene.name}`}
            </Text>
          </View>
        ))}
        {layout.rows.map((row, rowIndex) => (
          <React.Fragment key={row.id}>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: MATRIX_PADDING,
                top: gridTop + rowIndex * MATRIX_ROW_HEIGHT,
                width: MATRIX_LABEL_WIDTH - 8,
                height: MATRIX_ROW_HEIGHT,
                justifyContent: 'center',
              }}
            >
              <View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    {
                      position: 'relative',
                      left: 0,
                      width: MATRIX_LABEL_WIDTH - 8,
                      color: row.color,
                    },
                  ]}
                >
                  {row.label}
                </Text>
                {showRowCoverage && (
                  <Text style={[styles.rowPresence, { color: colors.textSecondary }]}>
                    {`${row.cells.size}/${layout.scenes.length} (${Math.round((row.cells.size / layout.scenes.length || 0) * 100)}%)`}
                  </Text>
                )}
              </View>
            </View>
            {layout.scenes.map((scene, sceneIndex) => {
              const value = row.cells.get(scene.id);
              if (!value) return null;
              return (
                <View
                  key={`${row.id}-${scene.id}`}
                  pointerEvents="none"
                  style={[
                    styles.cell,
                    {
                      left:
                        MATRIX_PADDING +
                        MATRIX_LABEL_WIDTH +
                        sceneIndex * layout.sceneWidth +
                        MATRIX_CELL_INSET,
                      top: gridTop + rowIndex * MATRIX_ROW_HEIGHT + 10,
                      width: layout.sceneWidth - MATRIX_CELL_INSET * 2,
                      height: MATRIX_ROW_HEIGHT - 20,
                      borderColor: row.color,
                      backgroundColor: `${row.color}2E`,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.cellText,
                      {
                        color: colors.text,
                        textAlign: value === '✓' ? 'center' : 'left',
                        fontSize: value === '✓' ? 16 : 10,
                      },
                    ]}
                  >
                    {value}
                  </Text>
                </View>
              );
            })}
          </React.Fragment>
        ))}
      </GraphCanvasFrame>
    );
  },
);
PresenceMatrixCanvas.displayName = 'PresenceMatrixCanvas';
export default PresenceMatrixCanvas;

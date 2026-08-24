import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import GraphCanvasFrame from '../graphs/GraphCanvasFrame/GraphCanvasFrame';
import { PanZoomCanvasHandle, usePanZoomCanvas } from '../../../hooks/usePanZoomCanvas';
import { useTheme } from '../../../theme';
import {
  buildMatrixThreadSegments,
  MATRIX_CELL_INSET,
  MATRIX_HEADER_HEIGHT,
  MATRIX_LABEL_WIDTH,
  MATRIX_PADDING,
  MATRIX_ROW_HEIGHT,
  MATRIX_THREAD_GAP_DASH,
  MATRIX_THREAD_OPACITY,
  MATRIX_THREAD_WIDTH,
  matrixRowCenterY,
  PresenceMatrixLayout,
} from '../../../utils/presenceMatrixLayout';

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
    const panZoom = usePanZoomCanvas(ref, layout, {
      minScale: 0.08,
      maxScale: 3,
      fitVerticalAlignment: 'top',
      refitOnLayoutChange: false,
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
    // Uma lista achatada de linhas, e não um Fragment por faixa: o react-native-svg nativo
    // percorre os filhos diretos do Svg, e agrupar é o tipo de coisa que funciona na web e
    // falha no aparelho.
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
    return (
      <GraphCanvasFrame width={layout.width} height={layout.height} {...panZoom}>
        <Svg width={layout.width} height={layout.height}>
          {layout.scenes.map((scene, index) => {
            const x = MATRIX_PADDING + MATRIX_LABEL_WIDTH + index * layout.sceneWidth;
            return (
              <React.Fragment key={scene.id}>
                <Rect
                  x={x}
                  y={MATRIX_PADDING + MATRIX_HEADER_HEIGHT}
                  width={layout.sceneWidth}
                  height={layout.rows.length * MATRIX_ROW_HEIGHT}
                  fill={index % 2 ? colors.surface : colors.background}
                  stroke={colors.border}
                  strokeWidth={0.5}
                />
                <Rect
                  x={x}
                  y={MATRIX_PADDING + MATRIX_HEADER_HEIGHT - 6}
                  width={layout.sceneWidth}
                  height={4}
                  fill={scene.chapterColor}
                />
              </React.Fragment>
            );
          })}
          {threads.map((thread) => (
            <Line
              key={thread.key}
              x1={thread.x1}
              y1={thread.y}
              x2={thread.x2}
              y2={thread.y}
              stroke={thread.color}
              strokeWidth={MATRIX_THREAD_WIDTH}
              strokeOpacity={MATRIX_THREAD_OPACITY}
              strokeLinecap="round"
              strokeDasharray={thread.isGap ? MATRIX_THREAD_GAP_DASH : undefined}
            />
          ))}
        </Svg>
        {chapterGroups.map((chapter) => (
          <View
            key={`${chapter.start}-${chapter.name}`}
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
          <TouchableOpacity
            key={`scene-${scene.id}`}
            onPress={() => onPressScene(scene.id)}
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
          </TouchableOpacity>
        ))}
        {layout.rows.map((row, rowIndex) => (
          <React.Fragment key={row.id}>
            <TouchableOpacity
              onPress={() => onPressRow(row.id)}
              style={{
                position: 'absolute',
                left: MATRIX_PADDING,
                top: MATRIX_PADDING + MATRIX_HEADER_HEIGHT + rowIndex * MATRIX_ROW_HEIGHT,
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
            </TouchableOpacity>
            {layout.scenes.map((scene, sceneIndex) => {
              const value = row.cells.get(scene.id);
              if (!value) return null;
              return (
                <TouchableOpacity
                  key={`${row.id}-${scene.id}`}
                  onPress={() => onPressScene(scene.id)}
                  style={[
                    styles.cell,
                    {
                      left:
                        MATRIX_PADDING +
                        MATRIX_LABEL_WIDTH +
                        sceneIndex * layout.sceneWidth +
                        MATRIX_CELL_INSET,
                      top:
                        MATRIX_PADDING + MATRIX_HEADER_HEIGHT + rowIndex * MATRIX_ROW_HEIGHT + 10,
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
                </TouchableOpacity>
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

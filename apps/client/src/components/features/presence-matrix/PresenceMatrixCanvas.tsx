import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import GraphCanvasFrame from '../graphs/GraphCanvasFrame/GraphCanvasFrame';
import { PanZoomCanvasHandle, usePanZoomCanvas } from '../../../hooks/usePanZoomCanvas';
import { useTheme } from '../../../theme';
import {
  MATRIX_HEADER_HEIGHT,
  MATRIX_LABEL_WIDTH,
  MATRIX_PADDING,
  MATRIX_ROW_HEIGHT,
  MATRIX_SCENE_WIDTH,
  PresenceMatrixLayout,
} from '../../../utils/presenceMatrixLayout';

interface Props {
  layout: PresenceMatrixLayout;
  onPressScene: (sceneId: string) => void;
  onPressRow: (rowId: string) => void;
}
export type PresenceMatrixCanvasHandle = PanZoomCanvasHandle;

const PresenceMatrixCanvas = forwardRef<PresenceMatrixCanvasHandle, Props>(
  ({ layout, onPressScene, onPressRow }, ref) => {
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
    return (
      <GraphCanvasFrame width={layout.width} height={layout.height} {...panZoom}>
        <Svg width={layout.width} height={layout.height}>
          {layout.scenes.map((scene, index) => {
            const x = MATRIX_PADDING + MATRIX_LABEL_WIDTH + index * MATRIX_SCENE_WIDTH;
            return (
              <React.Fragment key={scene.id}>
                <Rect
                  x={x}
                  y={MATRIX_PADDING + MATRIX_HEADER_HEIGHT}
                  width={MATRIX_SCENE_WIDTH}
                  height={layout.rows.length * MATRIX_ROW_HEIGHT}
                  fill={index % 2 ? colors.surface : colors.background}
                  stroke={colors.border}
                  strokeWidth={0.5}
                />
                <Rect
                  x={x}
                  y={MATRIX_PADDING + 44}
                  width={MATRIX_SCENE_WIDTH}
                  height={4}
                  fill={scene.chapterColor}
                />
              </React.Fragment>
            );
          })}
        </Svg>
        {layout.scenes.map((scene, index) => (
          <TouchableOpacity
            key={`scene-${scene.id}`}
            onPress={() => onPressScene(scene.id)}
            style={{
              position: 'absolute',
              left: MATRIX_PADDING + MATRIX_LABEL_WIDTH + index * MATRIX_SCENE_WIDTH + 4,
              top: MATRIX_PADDING,
              width: MATRIX_SCENE_WIDTH - 8,
              height: MATRIX_HEADER_HEIGHT - 8,
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
                  width: MATRIX_SCENE_WIDTH - 12,
                  color: colors.text,
                  fontSize: 10,
                },
              ]}
            >
              {scene.name}
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
              <Text
                numberOfLines={2}
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
                        MATRIX_PADDING + MATRIX_LABEL_WIDTH + sceneIndex * MATRIX_SCENE_WIDTH + 10,
                      top:
                        MATRIX_PADDING + MATRIX_HEADER_HEIGHT + rowIndex * MATRIX_ROW_HEIGHT + 10,
                      width: MATRIX_SCENE_WIDTH - 20,
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

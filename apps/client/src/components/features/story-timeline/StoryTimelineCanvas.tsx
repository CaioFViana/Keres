import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import { PanZoomCanvasHandle, usePanZoomCanvas } from '@/src/hooks/usePanZoomCanvas';
import { useTheme } from '@/src/theme';
import {
  StoryTimelineLayout,
  TIMELINE_HEADER_HEIGHT,
  TIMELINE_LABEL_PADDING,
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PADDING,
  TIMELINE_ROW_HEIGHT,
} from '@/src/utils/storyTimelineLayout';

interface Props {
  layout: StoryTimelineLayout;
  onPressScene: (id: string) => void;
  storyDurationLabel: string;
  storyDurationTitle: string;
}
export type StoryTimelineCanvasHandle = PanZoomCanvasHandle;

const StoryTimelineCanvas = forwardRef<StoryTimelineCanvasHandle, Props>(
  ({ layout, onPressScene, storyDurationLabel, storyDurationTitle }, ref) => {
    const { colors } = useTheme();
    const panZoom = usePanZoomCanvas(ref, layout, {
      minScale: 0.08,
      maxScale: 3,
      fitVerticalAlignment: 'top',
      fitMode: 'height',
      refitOnLayoutChange: false,
    });
    const styles = useMemo(
      () =>
        StyleSheet.create({
          rowLabel: {
            position: 'absolute',
            left: TIMELINE_PADDING + TIMELINE_LABEL_PADDING,
            width: TIMELINE_LABEL_WIDTH - TIMELINE_LABEL_PADDING - 8,
            justifyContent: 'center',
          },
          rowTitle: { fontSize: 12, fontWeight: '700' },
          chapter: { fontSize: 9, marginTop: 2 },
          bar: {
            position: 'absolute',
            height: 22,
            borderRadius: 6,
            justifyContent: 'center',
            paddingHorizontal: 6,
          },
          barText: { color: '#fff', fontSize: 9, fontWeight: '700', textAlign: 'center' },
          gapText: { position: 'absolute', fontSize: 9, textAlign: 'center' },
          sequence: { position: 'absolute', fontSize: 9, textAlign: 'center' },
        }),
      [],
    );
    const startY = TIMELINE_PADDING + TIMELINE_HEADER_HEIGHT;
    return (
      <GraphCanvasFrame width={layout.width} height={layout.height} {...panZoom}>
        <Svg width={layout.width} height={layout.height}>
          {layout.scaleMode === 'proportional' ? (
            <>
              <Line
                x1={TIMELINE_PADDING + TIMELINE_LABEL_WIDTH}
                y1={startY - 10}
                x2={layout.width - TIMELINE_PADDING}
                y2={startY - 10}
                stroke={colors.border}
              />
              {layout.rulerTicks.map((tick) => (
                <React.Fragment key={`${tick.x}-${tick.label}`}>
                  <Line
                    x1={tick.x}
                    y1={startY - 15}
                    x2={tick.x}
                    y2={startY - 5}
                    stroke={colors.textSecondary}
                  />
                  <SvgText
                    x={tick.x}
                    y={startY - 20}
                    fontSize={10}
                    textAnchor="middle"
                    fill={colors.textSecondary}
                  >
                    {tick.label}
                  </SvgText>
                </React.Fragment>
              ))}
            </>
          ) : (
            <>
              <SvgText
                x={TIMELINE_PADDING + TIMELINE_LABEL_PADDING}
                y={startY - 20}
                fontSize={10}
                fill={colors.textSecondary}
              >
                {storyDurationTitle}: {storyDurationLabel}
              </SvgText>
              {layout.chapters.map((chapter) => (
                <React.Fragment key={chapter.id}>
                  <Line
                    x1={chapter.start}
                    y1={startY - 10}
                    x2={chapter.end}
                    y2={startY - 10}
                    stroke={chapter.color}
                    strokeWidth={3}
                  />
                  <SvgText
                    x={(chapter.start + chapter.end) / 2}
                    y={startY - 20}
                    fontSize={10}
                    textAnchor="middle"
                    fill={chapter.color}
                  >
                    {chapter.durationLabel}
                  </SvgText>
                </React.Fragment>
              ))}
            </>
          )}
          {layout.rows.map((row, index) => {
            const y = startY + index * TIMELINE_ROW_HEIGHT;
            const centerY = y + TIMELINE_ROW_HEIGHT / 2;
            return (
              <React.Fragment key={row.id}>
                <Rect
                  x={TIMELINE_PADDING}
                  y={y}
                  width={layout.width - TIMELINE_PADDING * 2}
                  height={TIMELINE_ROW_HEIGHT}
                  fill={index % 2 ? colors.surface : colors.background}
                  stroke={colors.border}
                  strokeWidth={0.5}
                />
                {row.gapStart !== undefined && row.gapEnd !== undefined && (
                  <Line
                    x1={row.gapStart}
                    y1={centerY}
                    x2={row.gapEnd}
                    y2={centerY}
                    stroke={row.chapterColor}
                    strokeWidth={1.6}
                    strokeDasharray="5,4"
                  />
                )}
              </React.Fragment>
            );
          })}
        </Svg>
        {layout.rows.map((row, index) => {
          const y = startY + index * TIMELINE_ROW_HEIGHT;
          const centerY = y + TIMELINE_ROW_HEIGHT / 2;
          const barLeft = Math.min(row.barStart, row.barEnd);
          const barWidth = Math.max(5, Math.abs(row.barEnd - row.barStart));
          return (
            <React.Fragment key={row.id}>
              <TouchableOpacity
                onPress={() => onPressScene(row.id)}
                style={[styles.rowLabel, { top: y, height: TIMELINE_ROW_HEIGHT }]}
              >
                <Text numberOfLines={1} style={[styles.rowTitle, { color: row.chapterColor }]}>
                  {row.sequence}. {row.name}
                </Text>
                <Text numberOfLines={1} style={[styles.chapter, { color: row.chapterColor }]}>
                  {row.chapterName}
                </Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.sequence,
                  { left: row.barStart - 12, top: y + 3, width: 24, color: colors.textSecondary },
                ]}
              >
                {row.sequence}
              </Text>
              {row.gap && row.gapStart !== undefined && row.gapEnd !== undefined && (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.gapText,
                    {
                      left: Math.min(row.gapStart, row.gapEnd),
                      top: y + 5,
                      width: Math.max(32, Math.abs(row.gapEnd - row.gapStart)),
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  {row.gap.label}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => onPressScene(row.id)}
                style={[
                  styles.bar,
                  {
                    left: barLeft,
                    top: centerY - 11,
                    width: barWidth,
                    backgroundColor: row.chapterColor,
                  },
                ]}
              >
                {row.duration && (
                  <Text numberOfLines={1} style={styles.barText}>
                    {row.duration.label}
                  </Text>
                )}
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </GraphCanvasFrame>
    );
  },
);
StoryTimelineCanvas.displayName = 'StoryTimelineCanvas';
export default StoryTimelineCanvas;

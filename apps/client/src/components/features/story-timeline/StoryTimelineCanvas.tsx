import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import CanvasLine from '@/src/components/features/graphs/CanvasLine/CanvasLine';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '@/src/hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '@/src/hooks/usePanZoomCanvas';
import { useTheme } from '@/src/theme';
import type { StoryTimelineLayout } from '@keres/shared/graphs/storyTimelineLayout';
import {
  TIMELINE_LABEL_PADDING,
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PADDING,
  TIMELINE_ROW_HEIGHT,
} from '@keres/shared/graphs/storyTimelineLayout';

interface Props {
  layout: StoryTimelineLayout;
  onPressScene: (id: string) => void;
  storyDurationLabel: string;
  storyDurationTitle: string;
}
export type StoryTimelineCanvasHandle = PanZoomCanvasHandle;

/** Half the height of a 10pt line, to put a view's top where the SVG put a text's baseline. */
const CAPTION_LIFT = 9;

const StoryTimelineCanvas = forwardRef<StoryTimelineCanvasHandle, Props>(
  ({ layout, onPressScene, storyDurationLabel, storyDurationTitle }, ref) => {
    const { colors } = useTheme();
    const startY = TIMELINE_PADDING + layout.headerHeight;
    // The whole band answers to the finger, not only the label and the bar: on a proportional
    // scale a short scene is a couple of points wide and there is nothing to aim at. Hit-tested
    // here rather than covered with touch targets, which would eat the pinch (see `onTap`).
    const handleTap = useCallback(
      (point: { x: number; y: number }) => {
        const index = Math.floor((point.y - startY) / TIMELINE_ROW_HEIGHT);
        const row = index >= 0 ? layout.rows[index] : undefined;
        if (row) onPressScene(row.id);
      },
      [layout.rows, onPressScene, startY],
    );
    const panZoom = usePanZoomCanvas(ref, layout, {
      minScale: 0.08,
      maxScale: 3,
      fitVerticalAlignment: 'top',
      fitMode: 'height',
      refitOnLayoutChange: false,
      onTap: handleTap,
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
          band: { position: 'absolute', borderWidth: 0.5 },
          caption: { position: 'absolute', fontSize: 10 },
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
    return (
      <GraphCanvasFrame width={layout.width} height={layout.height} {...panZoom}>
        {layout.rows.map((row, index) => {
          const y = startY + index * TIMELINE_ROW_HEIGHT;
          const centerY = y + TIMELINE_ROW_HEIGHT / 2;
          return (
            <React.Fragment key={`band-${row.id}`}>
              <View
                style={[
                  styles.band,
                  {
                    left: TIMELINE_PADDING,
                    top: y,
                    width: layout.width - TIMELINE_PADDING * 2,
                    height: TIMELINE_ROW_HEIGHT,
                    backgroundColor: index % 2 ? colors.surface : colors.background,
                    borderColor: colors.border,
                  },
                ]}
              />
              {row.gapStart !== undefined && row.gapEnd !== undefined && (
                <CanvasLine
                  dashed
                  left={Math.min(row.gapStart, row.gapEnd)}
                  top={centerY - 0.8}
                  length={Math.abs(row.gapEnd - row.gapStart)}
                  thickness={1.6}
                  color={row.chapterColor}
                />
              )}
            </React.Fragment>
          );
        })}
        {layout.scaleMode === 'proportional' ? (
          <>
            <CanvasLine
              left={TIMELINE_PADDING + TIMELINE_LABEL_WIDTH}
              top={startY - 10}
              length={layout.width - TIMELINE_PADDING * 2 - TIMELINE_LABEL_WIDTH}
              thickness={1}
              color={colors.border}
            />
            {layout.rulerTicks.map((tick) => (
              <React.Fragment key={`${tick.x}-${tick.label}`}>
                <CanvasLine
                  vertical
                  left={tick.x}
                  top={startY - 15}
                  length={10}
                  thickness={1}
                  color={colors.textSecondary}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.caption,
                    {
                      left: tick.x - 40,
                      top: startY - 20 - CAPTION_LIFT,
                      width: 80,
                      textAlign: 'center',
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  {tick.label}
                </Text>
              </React.Fragment>
            ))}
          </>
        ) : (
          <>
            <Text
              numberOfLines={1}
              style={[
                styles.caption,
                {
                  left: TIMELINE_PADDING + TIMELINE_LABEL_PADDING,
                  top: startY - 20 - layout.chapterLaneCount * 18 - CAPTION_LIFT,
                  width: layout.width - TIMELINE_PADDING * 2,
                  color: colors.textSecondary,
                },
              ]}
            >
              {storyDurationTitle}: {storyDurationLabel}
            </Text>
            {layout.chapters.map((chapter) => (
              <React.Fragment key={chapter.id}>
                <CanvasLine
                  left={chapter.start}
                  top={startY - 11.5 - chapter.lane * 18}
                  length={chapter.end - chapter.start}
                  thickness={3}
                  color={chapter.color}
                />
                {chapter.durationLabel && (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.caption,
                      {
                        left: chapter.start,
                        top: startY - 20 - chapter.lane * 18 - CAPTION_LIFT,
                        width: Math.max(40, chapter.end - chapter.start),
                        textAlign: 'center',
                        color: chapter.color,
                      },
                    ]}
                  >
                    {chapter.durationLabel}
                  </Text>
                )}
              </React.Fragment>
            ))}
          </>
        )}
        {layout.rows.map((row, index) => {
          const y = startY + index * TIMELINE_ROW_HEIGHT;
          const centerY = y + TIMELINE_ROW_HEIGHT / 2;
          const barLeft = Math.min(row.barStart, row.barEnd);
          const barWidth = Math.max(5, Math.abs(row.barEnd - row.barStart));
          return (
            <React.Fragment key={row.id}>
              <View style={[styles.rowLabel, { top: y, height: TIMELINE_ROW_HEIGHT }]}>
                <Text numberOfLines={1} style={[styles.rowTitle, { color: row.chapterColor }]}>
                  {row.sequence}. {row.name}
                </Text>
                <Text numberOfLines={1} style={[styles.chapter, { color: row.chapterColor }]}>
                  {row.chapterName}
                </Text>
              </View>
              <Text
                style={[
                  styles.sequence,
                  {
                    left: row.barStart - 12,
                    top: y + 3,
                    width: 24,
                    color: colors.textSecondary,
                    pointerEvents: 'none',
                  },
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
                      pointerEvents: 'none',
                    },
                  ]}
                >
                  {row.gap.label}
                </Text>
              )}
              <View
                pointerEvents="none"
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
              </View>
            </React.Fragment>
          );
        })}
      </GraphCanvasFrame>
    );
  },
);
StoryTimelineCanvas.displayName = 'StoryTimelineCanvas';
export default StoryTimelineCanvas;

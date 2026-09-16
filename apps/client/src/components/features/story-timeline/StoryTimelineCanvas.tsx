import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import CanvasLine from '@/src/components/features/graphs/CanvasLine/CanvasLine';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import type { CanvasViewportHandle } from '@/src/hooks/useCanvasViewport';
import { useCanvasViewport } from '@/src/hooks/useCanvasViewport';
import { useTheme } from '@/src/theme';
import { spatialRectIntersects } from '@keres/shared';
import type { StoryTimelineLayout } from '@keres/shared/graphs/storyTimelineLayout';
import {
  TIMELINE_EVENT_LANE_HEIGHT,
  TIMELINE_LABEL_PADDING,
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PADDING,
  TIMELINE_ROW_HEIGHT,
} from '@keres/shared/graphs/storyTimelineLayout';

interface Props {
  layout: StoryTimelineLayout;
  onPressScene: (id: string) => void;
  onPressEvent?: (id: string) => void;
  showSceneNames?: boolean;
  /** Turns a row's elapsed time into a date, when the story has a calendar and an epoch. */
  dateForRow?: (elapsedSeconds: number) => string | null;
  storyDurationLabel: string;
  storyDurationTitle: string;
}
export type StoryTimelineCanvasHandle = CanvasViewportHandle;

/** Half the height of a 10pt line, to put a view's top where the SVG put a text's baseline. */
const CAPTION_LIFT = 9;

const StoryTimelineCanvas = forwardRef<StoryTimelineCanvasHandle, Props>(
  (
    {
      layout,
      onPressScene,
      onPressEvent,
      showSceneNames,
      dateForRow,
      storyDurationLabel,
      storyDurationTitle,
    },
    ref,
  ) => {
    const { colors } = useTheme();
    // Anchored containers get their own strip between the header and the scenes, so the scene rows
    // start below it. The header chrome stays where it was, measured from the top of that strip.
    const headerBaseY = TIMELINE_PADDING + layout.headerHeight;
    const startY = headerBaseY + layout.eventLaneCount * TIMELINE_EVENT_LANE_HEIGHT;
    // The whole band answers to the finger, not only the label and the bar: on a proportional
    // scale a short scene is a couple of points wide and there is nothing to aim at. Hit-tested
    // here rather than covered with touch targets, which would eat the pinch (see `onTap`).
    const handleTap = useCallback(
      (point: { x: number; y: number }) => {
        if (onPressEvent && point.y < startY) {
          const hit = [...layout.eventSpans].reverse().find((span) => {
            const top = headerBaseY + span.lane * TIMELINE_EVENT_LANE_HEIGHT;
            const pad = span.instant ? 10 : 0;
            return (
              point.y >= top &&
              point.y <= top + TIMELINE_EVENT_LANE_HEIGHT &&
              point.x >= span.start - pad &&
              point.x <= span.end + pad
            );
          });
          if (hit) {
            onPressEvent(hit.id);
            return;
          }
        }
        const index = Math.floor((point.y - startY) / TIMELINE_ROW_HEIGHT);
        const row = index >= 0 ? layout.rows[index] : undefined;
        if (!row) return;
        if (row.kind === 'event') onPressEvent?.(row.chapterId);
        else onPressScene(row.id);
      },
      [headerBaseY, layout.eventSpans, layout.rows, onPressEvent, onPressScene, startY],
    );
    const { containerRef, handleLayout, panHandlers, animatedTransform, renderWindow } =
      useCanvasViewport(ref, layout, {
        minScale: 0.08,
        maxScale: 3,
        fitVerticalAlignment: 'top',
        fitMode: 'height',
        refitOnLayoutChange: false,
        clampMode: 'free',
        onTap: handleTap,
      });
    /** Row indexes whose band reaches the culling window; bands, bars and labels cull with these. */
    const visibleRowIndexes = useMemo(
      () =>
        layout.rows.flatMap((row, index) =>
          spatialRectIntersects(
            {
              x: TIMELINE_PADDING,
              y: startY + index * TIMELINE_ROW_HEIGHT,
              width: layout.width - TIMELINE_PADDING * 2,
              height: TIMELINE_ROW_HEIGHT,
            },
            renderWindow,
          )
            ? [index]
            : [],
        ),
      [layout.rows, layout.width, renderWindow, startY],
    );
    const visibleSpans = useMemo(
      () =>
        layout.eventSpans.filter((span) =>
          spatialRectIntersects(
            {
              x: Math.min(span.start, span.end) - (span.instant ? 10 : 0),
              y: headerBaseY + span.lane * TIMELINE_EVENT_LANE_HEIGHT,
              width: Math.abs(span.end - span.start) + (span.instant ? 20 : 0),
              height: TIMELINE_EVENT_LANE_HEIGHT,
            },
            renderWindow,
          ),
        ),
      [headerBaseY, layout.eventSpans, renderWindow],
    );
    const visibleTicks = useMemo(
      () =>
        layout.rulerTicks.filter((tick) =>
          spatialRectIntersects(
            { x: tick.x - 40, y: headerBaseY - 30, width: 80, height: 30 },
            renderWindow,
          ),
        ),
      [headerBaseY, layout.rulerTicks, renderWindow],
    );
    const visibleChapters = useMemo(
      () =>
        layout.chapters.filter((chapter) =>
          spatialRectIntersects(
            {
              x: Math.min(chapter.start, chapter.end),
              y: headerBaseY - 29 - chapter.lane * 18,
              width: Math.abs(chapter.end - chapter.start),
              height: 29,
            },
            renderWindow,
          ),
        ),
      [headerBaseY, layout.chapters, renderWindow],
    );
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
          rowDate: { fontSize: 9, marginTop: 1, color: colors.textSecondary },
          chapter: { fontSize: 9, marginTop: 2 },
          band: { position: 'absolute', borderWidth: 0.5 },
          eventBand: { position: 'absolute', borderRadius: 4, borderWidth: 1 },
          eventLabel: { position: 'absolute', fontSize: 10, fontWeight: '700' },
          diamond: {
            position: 'absolute',
            width: 12,
            height: 12,
            transform: [{ rotate: '45deg' }],
          },
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
      [colors.textSecondary],
    );
    return (
      <GraphCanvasFrame
        containerRef={containerRef}
        handleLayout={handleLayout}
        panHandlers={panHandlers}
        animatedTransform={animatedTransform}
      >
        <View pointerEvents="none">
          {/*
          Anchored containers, drawn as bands across the scenes they cover. A dashed outline is a
          chapter placed somewhere other than where it is told; a solid one is an event. Only the
          first stretch carries the name - the others are the same container resuming.
        */}
          {visibleSpans.map((span) => {
            const top = headerBaseY + span.lane * TIMELINE_EVENT_LANE_HEIGHT;
            const width = Math.max(span.instant ? 0 : 4, span.end - span.start);
            const label = span.name.length <= 28 ? span.name : `${span.name.slice(0, 27)}…`;
            const fitsInside = !span.instant && width > label.length * 6;
            return (
              <React.Fragment key={`span-${span.id}-${span.stretchIndex}`}>
                {span.instant ? (
                  <View
                    style={[
                      styles.diamond,
                      {
                        left: span.start - 6,
                        top: top + TIMELINE_EVENT_LANE_HEIGHT / 2 - 6,
                        backgroundColor: span.color,
                      },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      styles.eventBand,
                      {
                        left: span.start,
                        top: top + 3,
                        width,
                        height: TIMELINE_EVENT_LANE_HEIGHT - 8,
                        backgroundColor: span.color,
                        opacity: span.isEvent ? 0.34 : 0.18,
                        borderColor: span.color,
                        borderStyle: span.isEvent ? 'solid' : 'dashed',
                      },
                    ]}
                  />
                )}
                {span.stretchIndex === 0 && (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.eventLabel,
                      {
                        left: fitsInside ? span.start : span.end + 6,
                        top: top + TIMELINE_EVENT_LANE_HEIGHT / 2 - CAPTION_LIFT,
                        width: fitsInside ? width : label.length * 7,
                        textAlign: fitsInside ? 'center' : 'left',
                        color: span.color,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                )}
              </React.Fragment>
            );
          })}
          {visibleRowIndexes.map((index) => {
            const row = layout.rows[index];
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
                top={headerBaseY - 10}
                length={layout.width - TIMELINE_PADDING * 2 - TIMELINE_LABEL_WIDTH}
                thickness={1}
                color={colors.border}
              />
              {visibleTicks.map((tick) => (
                <React.Fragment key={`${tick.x}-${tick.label}`}>
                  <CanvasLine
                    vertical
                    left={tick.x}
                    top={headerBaseY - 15}
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
                        top: headerBaseY - 20 - CAPTION_LIFT,
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
                    top: headerBaseY - 20 - layout.chapterLaneCount * 18 - CAPTION_LIFT,
                    width: layout.width - TIMELINE_PADDING * 2,
                    color: colors.textSecondary,
                  },
                ]}
              >
                {storyDurationTitle}: {storyDurationLabel}
              </Text>
              {visibleChapters.map((chapter) => (
                <React.Fragment key={chapter.id}>
                  <CanvasLine
                    left={chapter.start}
                    top={headerBaseY - 11.5 - chapter.lane * 18}
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
                          top: headerBaseY - 20 - chapter.lane * 18 - CAPTION_LIFT,
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
          {visibleRowIndexes.map((index) => {
            const row = layout.rows[index];
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
                  {/* The in-world date, when the story has said where on its calendar it opens. */}
                  {row.elapsedSeconds !== undefined && dateForRow?.(row.elapsedSeconds) ? (
                    <Text numberOfLines={1} style={styles.rowDate}>
                      {dateForRow(row.elapsedSeconds)}
                    </Text>
                  ) : null}
                </View>
                {row.sequence > 0 && (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.sequence,
                      {
                        left: showSceneNames ? row.barStart + 2 : row.barStart - 12,
                        top: y + 3,
                        width: showSceneNames ? 220 : 24,
                        textAlign: showSceneNames ? 'left' : 'center',
                        color: colors.textSecondary,
                        pointerEvents: 'none',
                      },
                    ]}
                  >
                    {showSceneNames ? `${row.sequence}. ${row.name}` : row.sequence}
                  </Text>
                )}
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
                {row.instant ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.diamond,
                      {
                        left: row.barStart - 6,
                        top: centerY - 6,
                        backgroundColor: row.chapterColor,
                      },
                    ]}
                  />
                ) : (
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
                )}
              </React.Fragment>
            );
          })}
        </View>
      </GraphCanvasFrame>
    );
  },
);
StoryTimelineCanvas.displayName = 'StoryTimelineCanvas';
export default StoryTimelineCanvas;

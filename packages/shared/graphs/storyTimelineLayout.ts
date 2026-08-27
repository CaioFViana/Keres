import { SCENE_POSITION_FRACTION, type ScenePosition } from '../metadata/ScenePosition';

/**
 * A pure layout for the narrative timeline. The order of the scenes never changes; the horizontal
 * axis only gives a compacted sense of duration. That avoids pretending that months, years and eons
 * have universal conversions.
 */
export interface StoryTimelineScene {
  id: string;
  name: string;
  chapterId: string;
  chapterName: string;
  chapterColor: string;
  chapterDurationLabel?: string;
  index: number;
  summary?: string | null;
  gap?: number | null;
  gapType?: string | null;
  gapLabel?: string;
  duration?: number | null;
  durationType?: string | null;
  durationLabel?: string;
  /** The scene starts a chapter selection whose immediate predecessor is not selected. */
  hideGapBefore?: boolean;
}

export const TIMELINE_PADDING = 28;
export const TIMELINE_LABEL_WIDTH = 196;
export const TIMELINE_LABEL_PADDING = 12;
export const TIMELINE_HEADER_HEIGHT = 82;
export const TIMELINE_ROW_HEIGHT = 58;
/** Vertical room one band of anchored containers takes above the scenes. */
export const TIMELINE_EVENT_LANE_HEIGHT = 24;
const MIN_DURATION_WIDTH = 26;
const MIN_GAP_WIDTH = 10;

const UNIT_RANK: Record<string, number> = {
  seconds: 0,
  minutes: 1,
  hours: 2,
  days: 3,
  weeks: 4,
  months: 5,
  years: 6,
  millennia: 7,
  eons: 8,
};

/**
 * A purely visual convention: it approximates calendar units to preserve useful proportions. The
 * original value is never altered and stays explicit in the label. An eon is worth a billion years
 * visually, letting fictional worlds use the unit without breaking the drawing.
 */
const VISUAL_SECONDS_PER_UNIT: Record<string, number> = {
  seconds: 1,
  minutes: 60,
  hours: 60 * 60,
  days: 24 * 60 * 60,
  weeks: 7 * 24 * 60 * 60,
  months: 30.4375 * 24 * 60 * 60,
  years: 365.25 * 24 * 60 * 60,
  millennia: 1000 * 365.25 * 24 * 60 * 60,
  eons: 1_000_000_000 * 365.25 * 24 * 60 * 60,
};

export interface StoryTimelineSegment {
  value: number;
  unit: string;
  label: string;
}

export interface StoryTimelineRow {
  id: string;
  chapterId: string;
  sequence: number;
  name: string;
  chapterName: string;
  chapterColor: string;
  summary?: string | null;
  barStart: number;
  barEnd: number;
  gapStart?: number;
  gapEnd?: number;
  gap?: StoryTimelineSegment;
  duration?: StoryTimelineSegment;
}

/** One end of a stretch, as the layout receives it. See `ChapterAnchorSchemas.ts`. */
export interface TimelineAnchorPoint {
  sceneId: string;
  position: ScenePosition;
  /** Negative is before the anchor. */
  offset?: number | null;
  offsetUnit?: string | null;
}

export interface TimelineAnchorStretch {
  start: TimelineAnchorPoint;
  end: TimelineAnchorPoint;
}

/**
 * A container placed against the timeline rather than living on it.
 *
 * An event is the usual case: it has no chapter number, and where it sits comes from what it was
 * anchored to. A chapter may be anchored too, which is how a flashback says when it happened as
 * opposed to when it is told.
 */
export interface TimelineAnchoredContainer {
  id: string;
  name: string;
  color: string;
  isEvent: boolean;
  stretches: TimelineAnchorStretch[];
}

/** A container drawn as a band across the scenes it covers. */
export interface StoryTimelineEventSpan {
  id: string;
  name: string;
  color: string;
  isEvent: boolean;
  /** Which stretch of that container this is, for one that pauses and resumes. */
  stretchIndex: number;
  start: number;
  end: number;
  lane: number;
  /** No scene it was anchored to is on screen, so there is nothing to draw it against. */
  unresolved?: boolean;
}

export interface StoryTimelineChapterSpan {
  id: string;
  name: string;
  color: string;
  durationLabel?: string;
  start: number;
  end: number;
  lane: number;
}

export interface StoryTimelineRulerTick {
  x: number;
  label: string;
}

export interface StoryTimelineLayout {
  rows: StoryTimelineRow[];
  chapters: StoryTimelineChapterSpan[];
  /** Containers anchored to the scenes, drawn in bands above them. */
  eventSpans: StoryTimelineEventSpan[];
  eventLaneCount: number;
  /**
   * Containers whose anchors name no scene that is on screen.
   *
   * Listed rather than dropped: an anchor pointing at a scene the reader filtered out is still a
   * statement the writer made, and silently omitting it would read as the app having lost it.
   */
  unanchoredNames: string[];
  rulerTicks: StoryTimelineRulerTick[];
  headerHeight: number;
  chapterLaneCount: number;
  width: number;
  height: number;
  scaleMode: StoryTimelineScaleMode;
  /** The smallest stretch became almost imperceptible on the proportional scale. */
  hasProportionalScaleWarning: boolean;
}

export type StoryTimelineScaleMode = 'compact' | 'proportional';

function segment(
  value: number | null | undefined,
  unit: string | null | undefined,
  label?: string,
) {
  if (!value || !Number.isFinite(value) || !unit || UNIT_RANK[unit] === undefined) return undefined;
  return { value, unit, label: label || `${value} ${unit}` };
}

/**
 * A second-order logarithmic scale: it avoids an infinite width for eons, while keeping the
 * difference between minutes, hours and days clearly visible. There is no artificial ceiling: the
 * chart grows horizontally and can be explored by pan/zoom.
 */
function compactLength(value: number, unit: string, minimum: number): number {
  const seconds = Math.abs(value) * (VISUAL_SECONDS_PER_UNIT[unit] ?? 1);
  const logarithm = Math.log1p(seconds);
  return minimum + logarithm * logarithm * (minimum === MIN_GAP_WIDTH ? 1.1 : 1.85);
}

const PROPORTIONAL_PIXELS_PER_HOUR = 30;
const PROPORTIONAL_MAX_WIDTH = 100_000;

function timingSeconds(value: number, unit: string): number {
  return Math.abs(value) * (VISUAL_SECONDS_PER_UNIT[unit] ?? 1);
}

function formatRulerSeconds(seconds: number): string {
  const absolute = Math.abs(seconds);
  const sign = seconds < 0 ? '−' : '';
  if (absolute >= VISUAL_SECONDS_PER_UNIT.eons)
    return `${sign}${Math.round(absolute / VISUAL_SECONDS_PER_UNIT.eons)} e`;
  if (absolute >= VISUAL_SECONDS_PER_UNIT.millennia)
    return `${sign}${Math.round(absolute / VISUAL_SECONDS_PER_UNIT.millennia)} ky`;
  if (absolute >= VISUAL_SECONDS_PER_UNIT.years)
    return `${sign}${Math.round(absolute / VISUAL_SECONDS_PER_UNIT.years)}y`;
  if (absolute >= VISUAL_SECONDS_PER_UNIT.months)
    return `${sign}${Math.round(absolute / VISUAL_SECONDS_PER_UNIT.months)}mo`;
  if (absolute >= VISUAL_SECONDS_PER_UNIT.days)
    return `${sign}${Math.round(absolute / VISUAL_SECONDS_PER_UNIT.days)}d`;
  if (absolute >= VISUAL_SECONDS_PER_UNIT.hours)
    return `${sign}${Math.round(absolute / VISUAL_SECONDS_PER_UNIT.hours)}h`;
  if (absolute >= VISUAL_SECONDS_PER_UNIT.minutes)
    return `${sign}${Math.round(absolute / VISUAL_SECONDS_PER_UNIT.minutes)}m`;
  return `${sign}${Math.round(absolute)}s`;
}

function buildRulerTicks(
  minSeconds: number,
  maxSeconds: number,
  originX: number,
  pixelsPerSecond: number,
): StoryTimelineRulerTick[] {
  const minimumStepPixels = 115;
  const baseSteps = [
    60,
    5 * 60,
    15 * 60,
    30 * 60,
    60 * 60,
    3 * 60 * 60,
    6 * 60 * 60,
    12 * 60 * 60,
    24 * 60 * 60,
    3 * 24 * 60 * 60,
    7 * 24 * 60 * 60,
    30 * 24 * 60 * 60,
    90 * 24 * 60 * 60,
    365.25 * 24 * 60 * 60,
  ];
  let step =
    baseSteps.find((entry) => entry * pixelsPerSecond >= minimumStepPixels) ?? baseSteps.at(-1)!;
  while (step * pixelsPerSecond < minimumStepPixels) step *= 10;
  const first = Math.ceil(minSeconds / step) * step;
  const ticks: StoryTimelineRulerTick[] = [];
  for (let value = first; value <= maxSeconds + step * 0.001; value += step) {
    ticks.push({ x: originX + value * pixelsPerSecond, label: formatRulerSeconds(value) });
  }
  return ticks;
}

/**
 * Builds a timeline for already-ordered scenes. The selection's first gap is prior context and takes
 * up no space: without the preceding scene drawn, showing it would suggest a continuity the
 * selection does not contain.
 */
export function buildStoryTimelineLayout(
  scenes: StoryTimelineScene[],
  scaleMode: StoryTimelineScaleMode = 'compact',
  anchored: TimelineAnchoredContainer[] = [],
): StoryTimelineLayout {
  const visibleSegments = scenes.flatMap((scene, index) => {
    const segments = [] as { value: number; unit: string; minimum: number }[];
    if (index > 0 && !scene.hideGapBefore) {
      const gap = segment(scene.gap, scene.gapType);
      if (gap) segments.push({ ...gap, minimum: MIN_GAP_WIDTH });
    }
    const duration = segment(scene.duration, scene.durationType);
    if (duration) segments.push({ ...duration, minimum: MIN_DURATION_WIDTH });
    return segments;
  });
  const totalSeconds = visibleSegments.reduce(
    (total, timing) => total + timingSeconds(timing.value, timing.unit),
    0,
  );
  const proportionalPixelsPerSecond =
    totalSeconds > 0
      ? Math.min(PROPORTIONAL_PIXELS_PER_HOUR / 3600, PROPORTIONAL_MAX_WIDTH / totalSeconds)
      : PROPORTIONAL_PIXELS_PER_HOUR / 3600;
  const segmentLength = (value: number, unit: string, minimum: number) =>
    scaleMode === 'proportional'
      ? timingSeconds(value, unit) * proportionalPixelsPerSecond
      : compactLength(value, unit, minimum);
  const hasProportionalScaleWarning =
    scaleMode === 'proportional' &&
    visibleSegments.some(
      (timing) => timingSeconds(timing.value, timing.unit) * proportionalPixelsPerSecond < 4,
    );
  let cursor = TIMELINE_PADDING + TIMELINE_LABEL_WIDTH;
  let timeCursor = 0;
  let minSeconds = 0;
  let maxSeconds = 0;
  let minX = cursor;
  let maxX = cursor;
  const rows = scenes.map((scene, rowIndex) => {
    const gap =
      rowIndex === 0 || scene.hideGapBefore
        ? undefined
        : segment(scene.gap, scene.gapType, scene.gapLabel);
    const duration = segment(scene.duration, scene.durationType, scene.durationLabel);
    const gapStart = cursor;
    if (gap) {
      cursor += Math.sign(gap.value) * segmentLength(gap.value, gap.unit, MIN_GAP_WIDTH);
      timeCursor += gap.value * (VISUAL_SECONDS_PER_UNIT[gap.unit] ?? 1);
    }
    const gapEnd = cursor;
    const barStart = cursor;
    const timeStart = timeCursor;
    if (duration) {
      cursor +=
        Math.sign(duration.value) *
        segmentLength(duration.value, duration.unit, MIN_DURATION_WIDTH);
      timeCursor += duration.value * (VISUAL_SECONDS_PER_UNIT[duration.unit] ?? 1);
    } else if (scaleMode === 'compact') cursor += MIN_DURATION_WIDTH;
    const barEnd = cursor;
    minSeconds = Math.min(minSeconds, timeStart, timeCursor);
    maxSeconds = Math.max(maxSeconds, timeStart, timeCursor);
    minX = Math.min(minX, gapStart, gapEnd, barStart, barEnd);
    maxX = Math.max(maxX, gapStart, gapEnd, barStart, barEnd);
    return {
      id: scene.id,
      chapterId: scene.chapterId,
      sequence: rowIndex + 1,
      name: scene.name,
      chapterName: scene.chapterName,
      chapterColor: scene.chapterColor,
      summary: scene.summary,
      barStart,
      barEnd,
      ...(gap ? { gapStart, gapEnd, gap } : {}),
      ...(duration ? { duration } : {}),
    };
  });

  const shift =
    minX < TIMELINE_PADDING + TIMELINE_LABEL_WIDTH
      ? TIMELINE_PADDING + TIMELINE_LABEL_WIDTH - minX
      : 0;
  if (shift) {
    rows.forEach((row) => {
      row.barStart += shift;
      row.barEnd += shift;
      if (row.gapStart !== undefined) row.gapStart += shift;
      if (row.gapEnd !== undefined) row.gapEnd += shift;
    });
    maxX += shift;
  }
  /*
   * Anchors resolved to pixels, here and not earlier: this is the only place that knows the scale.
   *
   * A point is a place inside a scene plus a distance from it. The place interpolates across the
   * scene's own bar - the timeline already measured it - and the distance is converted with exactly
   * the same scale the scene bars used, so "three hundred years before the first scene" lands as far
   * to the left as three hundred years is wide anywhere else on the drawing.
   */
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const resolvePoint = (point: TimelineAnchorPoint): number | undefined => {
    const row = rowById.get(point.sceneId);
    if (!row) return undefined;

    const base =
      row.barStart + (row.barEnd - row.barStart) * (SCENE_POSITION_FRACTION[point.position] ?? 0);
    if (!point.offset || !point.offsetUnit) return base;
    return (
      base + Math.sign(point.offset) * segmentLength(Math.abs(point.offset), point.offsetUnit, 0)
    );
  };

  const eventSpans: StoryTimelineEventSpan[] = [];
  const unanchoredNames: string[] = [];
  for (const container of anchored) {
    const resolved = container.stretches.flatMap((stretch, stretchIndex) => {
      const from = resolvePoint(stretch.start);
      const to = resolvePoint(stretch.end);
      if (from === undefined || to === undefined) return [];
      return [
        {
          id: container.id,
          name: container.name,
          color: container.color,
          isEvent: container.isEvent,
          stretchIndex,
          // Sorted, so a stretch stated back to front still draws as a band rather than as nothing.
          start: Math.min(from, to),
          end: Math.max(from, to),
          lane: 0,
        },
      ];
    });
    if (resolved.length === 0) unanchoredNames.push(container.name);
    eventSpans.push(...resolved);
  }

  /*
   * Lane packing, the same as the chapter spans below: a band drops to the next lane only when it
   * would sit on top of one already there. Every stretch of one container shares its lane, or a war
   * that pauses would read as two different wars.
   */
  eventSpans.sort((a, b) => a.start - b.start || a.end - b.end);
  const eventLaneEnds: number[] = [];
  const laneOfContainer = new Map<string, number>();
  for (const span of eventSpans) {
    const own = laneOfContainer.get(span.id);
    if (own !== undefined) {
      span.lane = own;
      eventLaneEnds[own] = Math.max(eventLaneEnds[own] ?? span.end, span.end);
      continue;
    }
    let lane = eventLaneEnds.findIndex((end) => end <= span.start);
    if (lane === -1) {
      lane = eventLaneEnds.length;
      eventLaneEnds.push(span.end);
    } else {
      eventLaneEnds[lane] = span.end;
    }
    span.lane = lane;
    laneOfContainer.set(span.id, lane);
  }
  const eventLaneCount = eventLaneEnds.length;

  /*
   * Anchors can reach outside the scenes, so the drawing has to move again to hold them.
   *
   * A second correction rather than a wider first one: the ghost anchor is measured from a scene bar,
   * and the bars do not exist until the first shift has run. Without this, "three hundred years before
   * the first scene" resolved to a negative x and was drawn underneath the label column.
   */
  const anchorMinX = eventSpans.reduce((left, span) => Math.min(left, span.start), minX);
  const anchorShift =
    anchorMinX < TIMELINE_PADDING + TIMELINE_LABEL_WIDTH
      ? TIMELINE_PADDING + TIMELINE_LABEL_WIDTH - anchorMinX
      : 0;
  if (anchorShift) {
    rows.forEach((row) => {
      row.barStart += anchorShift;
      row.barEnd += anchorShift;
      if (row.gapStart !== undefined) row.gapStart += anchorShift;
      if (row.gapEnd !== undefined) row.gapEnd += anchorShift;
    });
    eventSpans.forEach((span) => {
      span.start += anchorShift;
      span.end += anchorShift;
    });
    maxX += anchorShift;
  }
  for (const span of eventSpans) maxX = Math.max(maxX, span.end);

  const chapters = new Map<string, StoryTimelineChapterSpan>();
  rows.forEach((row) => {
    const start = Math.min(
      row.gapStart ?? row.barStart,
      row.gapEnd ?? row.barStart,
      row.barStart,
      row.barEnd,
    );
    const end = Math.max(
      row.gapStart ?? row.barStart,
      row.gapEnd ?? row.barStart,
      row.barStart,
      row.barEnd,
    );
    const existing = chapters.get(row.chapterId);
    if (existing) {
      existing.start = Math.min(existing.start, start);
      existing.end = Math.max(existing.end, end);
    } else {
      chapters.set(row.chapterId, {
        id: row.chapterId,
        name: row.chapterName,
        color: row.chapterColor,
        durationLabel: scenes.find((scene) => scene.chapterId === row.chapterId)
          ?.chapterDurationLabel,
        start,
        end,
        lane: 0,
      });
    }
  });

  const chapterSpans = [...chapters.values()];
  const laneEnds: number[] = [];
  for (const chapter of chapterSpans) {
    let lane = laneEnds.findIndex((end) => end <= chapter.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(chapter.end);
    } else {
      laneEnds[lane] = chapter.end;
    }
    chapter.lane = lane;
  }
  const chapterLaneCount = Math.max(1, laneEnds.length);
  const headerHeight =
    scaleMode === 'compact'
      ? TIMELINE_HEADER_HEIGHT + (chapterLaneCount - 1) * 18
      : TIMELINE_HEADER_HEIGHT;
  const rulerTicks =
    scaleMode === 'proportional'
      ? buildRulerTicks(
          minSeconds,
          maxSeconds,
          TIMELINE_PADDING + TIMELINE_LABEL_WIDTH + shift,
          proportionalPixelsPerSecond,
        )
      : [];
  return {
    rows,
    chapters: chapterSpans,
    eventSpans,
    eventLaneCount,
    unanchoredNames,
    rulerTicks,
    width: Math.max(620, Math.ceil(maxX + TIMELINE_PADDING)),
    // The event bands sit above the scenes, so each lane adds to the header rather than the body.
    height:
      TIMELINE_PADDING * 2 +
      headerHeight +
      eventLaneCount * TIMELINE_EVENT_LANE_HEIGHT +
      rows.length * TIMELINE_ROW_HEIGHT,
    scaleMode,
    hasProportionalScaleWarning,
    headerHeight,
    chapterLaneCount,
  };
}

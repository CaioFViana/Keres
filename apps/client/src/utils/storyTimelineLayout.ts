/**
 * Layout puro da linha do tempo narrativa. A ordem das cenas nunca muda; o eixo horizontal
 * apenas dá uma noção compactada de duração. Isso evita fingir que meses, anos e éons têm
 * conversões universais.
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
  /** A cena inicia um recorte de capítulos sem o predecessor imediato selecionado. */
  hideGapBefore?: boolean;
}

export const TIMELINE_PADDING = 28;
export const TIMELINE_LABEL_WIDTH = 196;
export const TIMELINE_LABEL_PADDING = 12;
export const TIMELINE_HEADER_HEIGHT = 82;
export const TIMELINE_ROW_HEIGHT = 58;
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
 * Convenção apenas visual: aproxima unidades de calendário para preservar proporções úteis.
 * O valor original nunca é alterado e continua explícito no rótulo. Um éon vale visualmente
 * um bilhão de anos, permitindo que mundos fictícios usem a unidade sem quebrar o desenho.
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
  rulerTicks: StoryTimelineRulerTick[];
  headerHeight: number;
  chapterLaneCount: number;
  width: number;
  height: number;
  scaleMode: StoryTimelineScaleMode;
  /** O menor trecho se tornou quase imperceptível na escala proporcional. */
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
 * Escala logarítmica de segunda ordem: evita uma largura infinita para éons, mas mantém a
 * diferença entre minutos, horas e dias bastante visível. Não há teto artificial: o gráfico
 * cresce horizontalmente e pode ser explorado por pan/zoom.
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
 * Constrói uma timeline para cenas já ordenadas. O primeiro gap da seleção é contexto anterior
 * e não ocupa espaço: sem a cena predecessora desenhada, mostrá-lo sugeriria uma continuidade
 * que o recorte não contém.
 */
export function buildStoryTimelineLayout(
  scenes: StoryTimelineScene[],
  scaleMode: StoryTimelineScaleMode = 'compact',
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
    rulerTicks,
    width: Math.max(620, Math.ceil(maxX + TIMELINE_PADDING)),
    height: TIMELINE_PADDING * 2 + headerHeight + rows.length * TIMELINE_ROW_HEIGHT,
    scaleMode,
    hasProportionalScaleWarning,
    headerHeight,
    chapterLaneCount,
  };
}

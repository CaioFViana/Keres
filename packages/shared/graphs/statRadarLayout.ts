import {
  formatStatValue,
  normalizeValue,
  OVERSHOOT_RATIO,
  type StatNotation,
  type StatTier,
} from './statLadder';

/**
 * Geometry of the stats radar chart. Pure, like `storyGraphLayout`/`locationGraphLayout`: the
 * interactive screen and the exported SVG consume this same object, so they never disagree about
 * where a vertex is.
 *
 * The drawing reserves `OVERSHOOT_RATIO` of the radius beyond the last ring for values that go past
 * the ladder's top; that band's outer ring is dashed, and it is what makes "above the scale"
 * visible without rescaling the whole chart because of one character.
 */

export const MIN_PRIMARY_STATS_FOR_CHART = 3;

export interface RadarStat {
  id: string;
  name: string;
  ladder: StatTier[];
}

export interface RadarSeriesInput {
  id: string;
  label: string;
  color: string;
  /** Valor por statId. Ausente ou `null` = sem valor, desenhado no centro. */
  values: ReadonlyMap<string, number | null>;
}

export interface RadarPoint {
  x: number;
  y: number;
}

export interface RadarAxis {
  statId: string;
  label: string;
  /** Radians, starting at the top and turning clockwise. */
  angle: number;
  end: RadarPoint;
  labelPoint: RadarPoint;
  textAnchor: 'start' | 'middle' | 'end';
}

export interface RadarRing {
  radius: number;
  label: string;
  /** `points` de um `<Polygon>`. */
  points: string;
  /** O anel externo da faixa de transbordo, desenhado tracejado. */
  isOverflow: boolean;
}

export interface RadarVertex extends RadarPoint {
  statId: string;
  value: number | null;
  display: string;
  isOverflow: boolean;
}

export interface RadarSeries {
  id: string;
  label: string;
  color: string;
  points: string;
  vertices: RadarVertex[];
}

export interface StatRadarLayout {
  size: number;
  center: RadarPoint;
  /** Raio do anel externo da escada (sem a faixa de transbordo). */
  radius: number;
  axes: RadarAxis[];
  rings: RadarRing[];
  series: RadarSeries[];
}

export interface StatRadarLayoutInput {
  stats: readonly RadarStat[];
  series: readonly RadarSeriesInput[];
  notation: StatNotation;
  /** Lado do quadrado do desenho, em pixels. */
  size: number;
  /** Space reserved for the axis labels. */
  padding?: number;
}

const DEFAULT_PADDING = 56;
const LABEL_GAP = 14;

const pointOn = (center: RadarPoint, angle: number, radius: number): RadarPoint => ({
  x: center.x + radius * Math.cos(angle),
  y: center.y + radius * Math.sin(angle),
});

const toPoints = (points: readonly RadarPoint[]): string =>
  points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ');

const round = (value: number): number => Math.round(value * 100) / 100;

function anchorFor(x: number, centerX: number): 'start' | 'middle' | 'end' {
  if (Math.abs(x - centerX) < 1) return 'middle';
  return x > centerX ? 'start' : 'end';
}

/**
 * Returns `null` when no polygon is possible: with fewer than three axes the drawing becomes a
 * line, and the screen shows an invitation to register more stats in place of the chart.
 */
export function buildStatRadarLayout(input: StatRadarLayoutInput): StatRadarLayout | null {
  const { stats, series, notation, size } = input;
  if (stats.length < MIN_PRIMARY_STATS_FOR_CHART) return null;

  const padding = input.padding ?? DEFAULT_PADDING;
  const center: RadarPoint = { x: size / 2, y: size / 2 };
  // The overshoot band has to fit inside the box, so the ladder's outer ring is smaller than the
  // available radius by the overshoot's proportion.
  const radius = Math.max(1, (size / 2 - padding) / (1 + OVERSHOOT_RATIO));

  const step = (Math.PI * 2) / stats.length;
  const startAngle = -Math.PI / 2;

  const axes: RadarAxis[] = stats.map((stat, index) => {
    const angle = startAngle + index * step;
    const end = pointOn(center, angle, radius * (1 + OVERSHOOT_RATIO));
    const labelPoint = pointOn(center, angle, radius * (1 + OVERSHOOT_RATIO) + LABEL_GAP);
    return {
      statId: stat.id,
      label: stat.name,
      angle,
      end: { x: round(end.x), y: round(end.y) },
      labelPoint: { x: round(labelPoint.x), y: round(labelPoint.y) },
      textAnchor: anchorFor(labelPoint.x, center.x),
    };
  });

  const ringPolygon = (ringRadius: number) =>
    toPoints(axes.map((axis) => pointOn(center, axis.angle, ringRadius)));

  // The rings come from the first axis's ladder: ladders can have different sizes per stat, and the
  // radar needs a single set of rings. The labels, therefore, apply to that axis - the others read
  // their own value at the vertex.
  const referenceLadder = stats[0]!.ladder;
  const intervals = Math.max(1, referenceLadder.length - 1);
  const rings: RadarRing[] = [];
  for (let index = 1; index <= intervals; index += 1) {
    const ringRadius = (radius * index) / intervals;
    rings.push({
      radius: round(ringRadius),
      label: referenceLadder[index]?.label ?? '',
      points: ringPolygon(ringRadius),
      isOverflow: false,
    });
  }
  rings.push({
    radius: round(radius * (1 + OVERSHOOT_RATIO)),
    label: '',
    points: ringPolygon(radius * (1 + OVERSHOOT_RATIO)),
    isOverflow: true,
  });

  const builtSeries: RadarSeries[] = series.map((entry) => {
    const vertices: RadarVertex[] = stats.map((stat, index) => {
      const axis = axes[index]!;
      const rawValue = entry.values.get(stat.id) ?? null;
      const normalized = rawValue === null ? 0 : normalizeValue(rawValue, stat.ladder);
      const point = pointOn(center, axis.angle, radius * normalized);
      return {
        statId: stat.id,
        value: rawValue,
        display: formatStatValue(rawValue, stat.ladder, notation),
        isOverflow: normalized > 1,
        x: round(point.x),
        y: round(point.y),
      };
    });

    return {
      id: entry.id,
      label: entry.label,
      color: entry.color,
      points: toPoints(vertices),
      vertices,
    };
  });

  return { size, center, radius: round(radius), axes, rings, series: builtSeries };
}

import { OVERSHOOT_RATIO, type StatTier } from '../../src/utils/statLadder';
import {
  buildStatRadarLayout,
  MIN_PRIMARY_STATS_FOR_CHART,
  type RadarStat,
} from '../../src/utils/statRadarLayout';

const LADDER: StatTier[] = [
  { label: 'F', minValue: 0 },
  { label: 'C', minValue: 50 },
  { label: 'A', minValue: 400 },
];

const statsOf = (names: string[]): RadarStat[] =>
  names.map((name) => ({ id: name.toLowerCase(), name, ladder: LADDER }));

const seriesOf = (id: string, values: Record<string, number | null>, color = '#f00') => ({
  id,
  label: id,
  color,
  values: new Map(Object.entries(values)),
});

const SIZE = 400;
const build = (stats: RadarStat[], series: ReturnType<typeof seriesOf>[] = []) =>
  buildStatRadarLayout({ stats, series, notation: 'letter' as const, size: SIZE });

describe('buildStatRadarLayout', () => {
  it('refuses to draw a polygon with fewer than three axes', () => {
    expect(build(statsOf(['Força', 'Astúcia']))).toBeNull();
    expect(MIN_PRIMARY_STATS_FOR_CHART).toBe(3);
  });

  it('draws one axis per stat, starting at the top and turning clockwise', () => {
    const layout = build(statsOf(['A', 'B', 'C', 'D']))!;

    expect(layout.axes.map((axis) => axis.label)).toEqual(['A', 'B', 'C', 'D']);
    // Primeiro eixo no topo: mesmo x do centro, y menor.
    expect(layout.axes[0]!.end.x).toBeCloseTo(layout.center.x, 1);
    expect(layout.axes[0]!.end.y).toBeLessThan(layout.center.y);
    // Segundo eixo à direita, um quarto de volta adiante.
    expect(layout.axes[1]!.end.x).toBeGreaterThan(layout.center.x);
    expect(layout.axes[1]!.end.y).toBeCloseTo(layout.center.y, 1);
  });

  it('anchors each axis label away from the centre', () => {
    const layout = build(statsOf(['A', 'B', 'C', 'D']))!;

    expect(layout.axes[0]!.textAnchor).toBe('middle');
    expect(layout.axes[1]!.textAnchor).toBe('start');
    expect(layout.axes[3]!.textAnchor).toBe('end');
  });

  it('keeps the overflow band inside the drawing box', () => {
    const layout = build(statsOf(['A', 'B', 'C']))!;
    const overflowRing = layout.rings.at(-1)!;

    expect(overflowRing.isOverflow).toBe(true);
    expect(overflowRing.radius).toBeCloseTo(layout.radius * (1 + OVERSHOOT_RATIO), 1);
    expect(overflowRing.radius).toBeLessThanOrEqual(SIZE / 2);
  });

  it('draws one ring per interval of the reference ladder, plus the overflow ring', () => {
    const layout = build(statsOf(['A', 'B', 'C']))!;

    // A escada tem 3 degraus, ou seja 2 intervalos: 2 anéis + o de transbordo.
    expect(layout.rings).toHaveLength(3);
    expect(layout.rings.filter((ring) => !ring.isOverflow).map((ring) => ring.label)).toEqual([
      'C',
      'A',
    ]);
  });

  it('places a value at the centre when the character has none', () => {
    const layout = build(statsOf(['A', 'B', 'C']), [seriesOf('ilda', { a: null })])!;
    const vertex = layout.series[0]!.vertices[0]!;

    expect(vertex.x).toBeCloseTo(layout.center.x, 1);
    expect(vertex.y).toBeCloseTo(layout.center.y, 1);
    expect(vertex.display).toBe('—');
  });

  it('puts the top of the ladder on the outer ring', () => {
    const layout = build(statsOf(['A', 'B', 'C']), [seriesOf('ilda', { a: 400 })])!;
    const vertex = layout.series[0]!.vertices[0]!;

    expect(layout.center.y - vertex.y).toBeCloseTo(layout.radius, 1);
    expect(vertex.isOverflow).toBe(false);
  });

  it('marks and draws a value above the ladder outside the outer ring', () => {
    const layout = build(statsOf(['A', 'B', 'C']), [seriesOf('ilda', { a: 100000 })])!;
    const vertex = layout.series[0]!.vertices[0]!;

    expect(vertex.isOverflow).toBe(true);
    expect(layout.center.y - vertex.y).toBeCloseTo(layout.radius * (1 + OVERSHOOT_RATIO), 1);
  });

  it('shows the tier label of each vertex in letter notation', () => {
    const layout = build(statsOf(['A', 'B', 'C']), [seriesOf('ilda', { a: 100 })])!;

    expect(layout.series[0]!.vertices[0]!.display).toBe('C');
  });

  it('shows the raw number in number notation', () => {
    const layout = buildStatRadarLayout({
      stats: statsOf(['A', 'B', 'C']),
      series: [seriesOf('ilda', { a: 100 })],
      notation: 'number',
      size: SIZE,
    })!;

    expect(layout.series[0]!.vertices[0]!.display).toBe('100');
  });

  it('builds one polygon string per series, with a point per axis', () => {
    const layout = build(statsOf(['A', 'B', 'C']), [
      seriesOf('ilda', { a: 400, b: 50, c: 0 }, '#00f'),
      seriesOf('bento', { a: 0, b: 400, c: 50 }, '#0f0'),
    ])!;

    expect(layout.series).toHaveLength(2);
    for (const series of layout.series) {
      expect(series.points.split(' ')).toHaveLength(3);
      expect(series.vertices).toHaveLength(3);
    }
    expect(layout.series[0]!.color).toBe('#00f');
  });

  it('lets each stat keep its own ladder', () => {
    const stats: RadarStat[] = [
      { id: 'a', name: 'A', ladder: LADDER },
      {
        id: 'b',
        name: 'B',
        ladder: [
          { label: 'zero', minValue: 0 },
          { label: 'ten', minValue: 10 },
        ],
      },
      { id: 'c', name: 'C', ladder: LADDER },
    ];
    const layout = buildStatRadarLayout({
      stats,
      series: [seriesOf('ilda', { a: 400, b: 10 })],
      notation: 'letter',
      size: SIZE,
    })!;

    // 400 no eixo A e 10 no eixo B são o topo de escadas diferentes: os dois no anel externo.
    const [first, second] = layout.series[0]!.vertices;
    expect(layout.center.y - first!.y).toBeCloseTo(layout.radius, 1);
    expect(second!.display).toBe('ten');
  });
});

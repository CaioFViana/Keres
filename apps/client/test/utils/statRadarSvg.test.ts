import type { StatTier } from '@keres/shared/graphs/statLadder';
import { buildStatRadarLayout, type RadarStat } from '@keres/shared/graphs/statRadarLayout';
import { renderStatRadarSvg, type StatRadarSvgOptions } from '@keres/shared/graphs/statRadarSvg';

const LADDER: StatTier[] = [
  { label: 'F', minValue: 0 },
  { label: 'C', minValue: 50 },
  { label: 'A', minValue: 400 },
];

const STATS: RadarStat[] = ['Força', 'Astúcia', 'Reputação'].map((name) => ({
  id: name.toLowerCase(),
  name,
  ladder: LADDER,
}));

const options = (overrides: Partial<StatRadarSvgOptions> = {}): StatRadarSvgOptions => ({
  title: 'A Queda',
  subtitle: 'Ilda · modo normal',
  showLegend: false,
  colors: {
    background: '#ffffff',
    surface: '#f2f2f2',
    text: '#111111',
    textSecondary: '#666666',
    border: '#cccccc',
  },
  ...overrides,
});

const layoutWith = (values: Record<string, number | null>, seriesCount = 1) =>
  buildStatRadarLayout({
    stats: STATS,
    series: Array.from({ length: seriesCount }, (_, index) => ({
      id: `series-${index}`,
      label: index === 0 ? 'Ilda' : 'Bento',
      color: index === 0 ? '#0055ff' : '#cc0000',
      values: new Map(Object.entries(values)),
    })),
    notation: 'letter',
    size: 320,
  })!;

describe('renderStatRadarSvg', () => {
  it('produces a standalone document with the story title', () => {
    const svg = renderStatRadarSvg(layoutWith({ força: 400 }), options());

    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<title>A Queda</title>');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('draws one polygon per ring, per series, and the axis labels', () => {
    const svg = renderStatRadarSvg(layoutWith({ força: 400 }), options());

    // Two rings of the ladder + the overflow one + the series' polygon.
    expect(svg.match(/<polygon /g)).toHaveLength(4);
    for (const stat of STATS) expect(svg).toContain(`>${stat.name}<`);
  });

  it('dashes only the overflow ring', () => {
    const svg = renderStatRadarSvg(layoutWith({ força: 400 }), options());

    expect(svg.match(/stroke-dasharray/g)).toHaveLength(1);
  });

  it('omits the legend when asked to', () => {
    const svg = renderStatRadarSvg(layoutWith({ força: 400 }), options());

    expect(svg).not.toContain('>Ilda<');
  });

  it('lists every series in the legend when asked to', () => {
    const svg = renderStatRadarSvg(layoutWith({ força: 400 }, 2), options({ showLegend: true }));

    expect(svg).toContain('>Ilda<');
    expect(svg).toContain('>Bento<');
  });

  it('escapes text that would otherwise break the document', () => {
    const svg = renderStatRadarSvg(layoutWith({ força: 400 }), options({ title: 'Fogo & <Aço>' }));

    expect(svg).toContain('Fogo &amp; &lt;Aço&gt;');
    expect(svg).not.toContain('<Aço>');
  });

  it('paints an overflowing vertex with a bigger dot', () => {
    const overflowing = renderStatRadarSvg(layoutWith({ força: 100000 }), options());
    const normal = renderStatRadarSvg(layoutWith({ força: 400 }), options());

    expect(overflowing).toContain('r="5"');
    expect(normal).not.toContain('r="5"');
  });
});

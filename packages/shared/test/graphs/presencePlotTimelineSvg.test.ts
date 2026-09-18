import { describe, expect, it } from 'vitest';
import { buildPlotCoverage, type PlotCoverageInput } from '../../graphs/plotCoverageLayout';
import { renderPlotCoverageSvg } from '../../graphs/plotCoverageSvg';
import { buildPresenceMatrixLayout } from '../../graphs/presenceMatrixLayout';
import { renderPresenceMatrixSvg } from '../../graphs/presenceMatrixSvg';
import { buildStoryTimelineLayout } from '../../graphs/storyTimelineLayout';
import { renderStoryTimelineSvg } from '../../graphs/storyTimelineSvg';

const COLORS = {
  background: '#ffffff',
  surface: '#f2f2f2',
  text: '#111111',
  textSecondary: '#666666',
  border: '#cccccc',
  primary: '#0033aa',
};

/**
 * The PNG contract, from the raster side: `parseSvgRootSize` refuses anything without plain
 * numeric root dimensions, and `sanitizeSvgForRaster` only rewrites this exact font list.
 */
function expectStandaloneContract(svg: string) {
  expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  const dims = svg.match(/<svg\b[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"[^>]*>/);
  expect(dims).not.toBeNull();
  const [, width, height] = dims as RegExpMatchArray;
  expect(Number(width)).toBeGreaterThan(0);
  expect(Number(height)).toBeGreaterThan(0);
  expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
  expect(svg).toContain('font-family="Helvetica, Arial, sans-serif"');
}

describe('presence matrix SVG export', () => {
  const layout = () =>
    buildPresenceMatrixLayout(
      [{ id: 's1', name: 'Abertura', chapterName: 'Cap & Um', chapterColor: '#0055ff' }],
      [{ id: 'r1', label: 'Herói', color: '#aa0000', cells: new Map([['s1', 'presente']]) }],
    );
  const options = {
    title: 'Presença',
    subtitle: '1 cena, 1 arco',
    background: COLORS.background,
    surface: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
    showRowCoverage: true,
  };

  it('emits a standalone document the PNG rasterizer accepts', () => {
    expectStandaloneContract(renderPresenceMatrixSvg(layout(), options));
  });

  it('draws the chapters, rows and cells with escaped names', () => {
    const svg = renderPresenceMatrixSvg(layout(), options);
    expect(svg).toContain('Cap &amp; Um');
    expect(svg).toContain('Herói');
    expect(svg).toContain('presente');
    expect(svg).toContain('1/1 (100%)');
  });
});

describe('plot coverage SVG export', () => {
  const input: PlotCoverageInput = {
    plots: [{ id: 'p1', name: 'Trama & Fuga' }],
    chapters: [{ id: 'c1', name: 'Capítulo 1', color: '#0055ff' }],
    scenes: [
      { id: 's1', chapterId: 'c1' },
      { id: 's2', chapterId: 'c1' },
    ],
    relations: [{ plotId: 'p1', sceneId: 's1' }],
  };
  const options = {
    title: 'Cobertura',
    subtitle: '1 trama',
    average: 'Média 50%',
    background: COLORS.background,
    surface: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
    primary: COLORS.primary,
  };

  it('emits a standalone document the PNG rasterizer accepts', () => {
    expectStandaloneContract(renderPlotCoverageSvg(buildPlotCoverage(input), options));
  });

  it('draws every plot with its coverage and escaped name', () => {
    const svg = renderPlotCoverageSvg(buildPlotCoverage(input), options);
    expect(svg).toContain('Trama &amp; Fuga');
    expect(svg).toContain('1/2 · 50%');
    expect(svg).toContain('Média 50%');
  });

  it('stays a valid document with no plots at all', () => {
    const svg = renderPlotCoverageSvg(
      buildPlotCoverage({ plots: [], chapters: [], scenes: [], relations: [] }),
      options,
    );
    expectStandaloneContract(svg);
  });
});

describe('story timeline SVG export', () => {
  const layout = () =>
    buildStoryTimelineLayout([
      {
        id: 's1',
        name: 'Abertura & Fim',
        chapterId: 'c1',
        chapterName: 'Cap 1',
        chapterColor: '#0055ff',
        index: 0,
      },
      {
        id: 's2',
        name: 'Meio',
        chapterId: 'c1',
        chapterName: 'Cap 1',
        chapterColor: '#0055ff',
        index: 1,
      },
    ]);
  const options = {
    title: 'Linha do tempo',
    subtitle: '2 cenas',
    labels: { gap: 'Hiato', duration: 'Duração', compressed: 'Comprimido' },
    storyDuration: { title: 'Duração', value: '2 dias' },
    showSceneNames: true,
    colors: COLORS,
  };

  it('emits a standalone document the PNG rasterizer accepts', () => {
    expectStandaloneContract(renderStoryTimelineSvg(layout(), options));
  });

  it('names the scenes with escaped titles', () => {
    const svg = renderStoryTimelineSvg(layout(), options);
    expect(svg).toContain('Abertura &amp; Fim');
    expect(svg).toContain('Meio');
  });
});

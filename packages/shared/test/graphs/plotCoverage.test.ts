import { describe, expect, it } from 'vitest';
import { buildPlotCoverage } from '../../graphs/plotCoverageLayout';
import { renderPlotCoverageSvg } from '../../graphs/plotCoverageSvg';

const chapters = [
  { id: 'act-1', name: 'Ato I', color: '#8D6B13' },
  { id: 'act-2', name: 'Ato II', color: '#16803C' },
];
/** Quatro cenas: duas em cada ato. */
const scenes = [
  { id: 's1', chapterId: 'act-1' },
  { id: 's2', chapterId: 'act-1' },
  { id: 's3', chapterId: 'act-2' },
  { id: 's4', chapterId: 'act-2' },
];
const plots = [{ id: 'p1', name: 'Redenção' }];

const options = {
  title: 'A Queda',
  subtitle: 'Cobertura das tramas',
  average: 'Média: 2,0',
  background: '#ffffff',
  surface: '#f2f2f2',
  text: '#111111',
  border: '#cccccc',
  primary: '#0033aa',
};

describe('buildPlotCoverage', () => {
  it('splits the coverage by chapter, in narrative order', () => {
    const [entry] = buildPlotCoverage({
      plots,
      chapters,
      scenes,
      relations: [
        { plotId: 'p1', sceneId: 's3' },
        { plotId: 'p1', sceneId: 's1' },
      ],
    });

    expect(entry.covered).toBe(2);
    expect(entry.percentage).toBe(50);
    expect(entry.segments).toEqual([
      {
        chapterId: 'act-1',
        chapterName: 'Ato I',
        color: '#8D6B13',
        covered: 1,
        percentage: 25,
      },
      {
        chapterId: 'act-2',
        chapterName: 'Ato II',
        color: '#16803C',
        covered: 1,
        percentage: 25,
      },
    ]);
  });

  /**
   * É o que a barra dividida veio responder: duas tramas com a mesma cobertura, uma concentrada
   * e outra espalhada, deixam de parecer a mesma coisa.
   */
  it('tells a plot concentrated in one act apart from one that crosses the whole story', () => {
    const [concentrada, espalhada] = buildPlotCoverage({
      plots: [
        { id: 'p1', name: 'Concentrada' },
        { id: 'p2', name: 'Espalhada' },
      ],
      chapters,
      scenes,
      relations: [
        { plotId: 'p1', sceneId: 's1' },
        { plotId: 'p1', sceneId: 's2' },
        { plotId: 'p2', sceneId: 's1' },
        { plotId: 'p2', sceneId: 's3' },
      ],
    });

    expect(concentrada.percentage).toBe(espalhada.percentage);
    expect(concentrada.segments).toHaveLength(1);
    expect(espalhada.segments).toHaveLength(2);
  });

  it('keeps an empty plot on the list, with a bar with no pieces', () => {
    const [entry] = buildPlotCoverage({ plots, chapters, scenes, relations: [] });

    expect(entry).toMatchObject({ covered: 0, percentage: 0, segments: [] });
  });

  it('ignores a relation pointing at a scene that is not in the story', () => {
    const [entry] = buildPlotCoverage({
      plots,
      chapters,
      scenes,
      relations: [
        { plotId: 'p1', sceneId: 's1' },
        { plotId: 'p1', sceneId: 'apagada' },
      ],
    });

    expect(entry.covered).toBe(1);
  });

  it('does not divide by zero in a story with no scenes', () => {
    const [entry] = buildPlotCoverage({ plots, chapters, scenes: [], relations: [] });

    expect(entry).toMatchObject({ covered: 0, total: 0, percentage: 0 });
  });
});

describe('renderPlotCoverageSvg', () => {
  const entries = buildPlotCoverage({
    plots,
    chapters,
    scenes,
    relations: [
      { plotId: 'p1', sceneId: 's1' },
      { plotId: 'p1', sceneId: 's3' },
    ],
  });

  it('draws one piece per chapter, with the chapter colour', () => {
    const svg = renderPlotCoverageSvg(entries, options);

    expect(svg).toContain('#8D6B13');
    expect(svg).toContain('#16803C');
  });

  it('includes the legend of the chapters that appear in the bars', () => {
    const svg = renderPlotCoverageSvg(entries, options);

    expect(svg).toContain('Ato I');
    expect(svg).toContain('Ato II');
  });

  it('draws no legend when no plot has a scene', () => {
    const empty = buildPlotCoverage({ plots, chapters, scenes, relations: [] });

    expect(renderPlotCoverageSvg(empty, options)).not.toContain('Ato I');
  });
});

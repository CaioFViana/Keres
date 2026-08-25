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
  it('divide a cobertura por capítulo, na ordem narrativa', () => {
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
  it('distingue uma trama concentrada num ato de outra que atravessa a história', () => {
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

  it('mantém a trama vazia na lista, com a barra sem pedaços', () => {
    const [entry] = buildPlotCoverage({ plots, chapters, scenes, relations: [] });

    expect(entry).toMatchObject({ covered: 0, percentage: 0, segments: [] });
  });

  it('ignora relação apontando para cena que não está na história', () => {
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

  it('não divide por zero numa história sem cenas', () => {
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

  it('desenha um pedaço por capítulo, com a cor do capítulo', () => {
    const svg = renderPlotCoverageSvg(entries, options);

    expect(svg).toContain('#8D6B13');
    expect(svg).toContain('#16803C');
  });

  it('inclui a legenda dos capítulos que aparecem nas barras', () => {
    const svg = renderPlotCoverageSvg(entries, options);

    expect(svg).toContain('Ato I');
    expect(svg).toContain('Ato II');
  });

  it('não desenha legenda quando nenhuma trama tem cena', () => {
    const empty = buildPlotCoverage({ plots, chapters, scenes, relations: [] });

    expect(renderPlotCoverageSvg(empty, options)).not.toContain('Ato I');
  });
});

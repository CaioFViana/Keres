import {
  buildMatrixThreadSegments,
  buildPresenceMatrixLayout,
  MATRIX_CELL_INSET,
  MATRIX_LABEL_WIDTH,
  MATRIX_PADDING,
  MATRIX_SCENE_WIDTH,
  type PresenceMatrixRow,
} from '../../src/utils/presenceMatrixLayout';

const scene = (id: string) => ({
  id,
  name: id,
  chapterName: 'Chapter',
  chapterColor: '#123456',
});

describe('presence matrix layout', () => {
  it('keeps the spacious scene columns for short stories', () => {
    const layout = buildPresenceMatrixLayout([scene('one'), scene('two')], []);

    expect(layout.sceneWidth).toBe(MATRIX_SCENE_WIDTH);
  });

  it('uses progressively narrower columns for longer stories', () => {
    const medium = buildPresenceMatrixLayout(
      Array.from({ length: 10 }, (_, index) => scene(`${index}`)),
      [],
    );
    const long = buildPresenceMatrixLayout(
      Array.from({ length: 20 }, (_, index) => scene(`${index}`)),
      [],
    );

    expect(medium.sceneWidth).toBeLessThan(MATRIX_SCENE_WIDTH);
    expect(long.sceneWidth).toBeLessThan(medium.sceneWidth);
  });
});

const row = (sceneIds: string[]): PresenceMatrixRow => ({
  id: 'row',
  label: 'Trama',
  color: '#0B6E99',
  cells: new Map(sceneIds.map((id) => [id, 'nota'])),
});
const scenes = (count: number) =>
  Array.from({ length: count }, (_, index) => scene(`${index}`));
const columnOf = (index: number, width = MATRIX_SCENE_WIDTH) =>
  MATRIX_PADDING + MATRIX_LABEL_WIDTH + index * width;
/** Borda esquerda e direita da célula: o fio começa e termina nelas, não no centro. */
const cellStart = (index: number, width = MATRIX_SCENE_WIDTH) =>
  columnOf(index, width) + MATRIX_CELL_INSET;
const cellEnd = (index: number, width = MATRIX_SCENE_WIDTH) =>
  columnOf(index, width) + width - MATRIX_CELL_INSET;

describe('matrix thread', () => {
  it('joins neighbouring appearances with a solid stretch', () => {
    const segments = buildMatrixThreadSegments(row(['0', '1']), scenes(4), MATRIX_SCENE_WIDTH);

    expect(segments).toEqual([{ x1: cellEnd(0), x2: cellStart(1), isGap: false }]);
  });

  it('marks the stretch over scenes the series skips as a gap', () => {
    const segments = buildMatrixThreadSegments(
      row(['0', '3', '4']),
      scenes(5),
      MATRIX_SCENE_WIDTH,
    );

    expect(segments).toEqual([
      { x1: cellEnd(0), x2: cellStart(3), isGap: true },
      { x1: cellEnd(3), x2: cellStart(4), isGap: false },
    ]);
  });

  it('starts at the first appearance and stops at the last, never spanning the whole band', () => {
    const segments = buildMatrixThreadSegments(row(['1', '2']), scenes(6), MATRIX_SCENE_WIDTH);

    expect(segments.at(0)?.x1).toBe(cellEnd(1));
    expect(segments.at(-1)?.x2).toBe(cellStart(2));
  });

  it('stays in the gutter between cells instead of running underneath them', () => {
    const [segment] = buildMatrixThreadSegments(row(['0', '1']), scenes(3), MATRIX_SCENE_WIDTH);

    // Uma célula ocupa [cellStart, cellEnd]; o trecho vive inteiro depois de uma e antes da
    // outra, senão o risco apareceria por cima da nota através do preenchimento translúcido.
    expect(segment.x1).toBeGreaterThanOrEqual(cellEnd(0));
    expect(segment.x2).toBeLessThanOrEqual(cellStart(1));
    expect(segment.x2 - segment.x1).toBe(MATRIX_CELL_INSET * 2);
  });

  it('draws nothing for a series that appears once or never', () => {
    expect(buildMatrixThreadSegments(row(['2']), scenes(4), MATRIX_SCENE_WIDTH)).toEqual([]);
    expect(buildMatrixThreadSegments(row([]), scenes(4), MATRIX_SCENE_WIDTH)).toEqual([]);
  });

  it('follows the narrower columns a longer story uses', () => {
    const layout = buildPresenceMatrixLayout(scenes(20), [row(['0', '1'])]);
    const segments = buildMatrixThreadSegments(row(['0', '1']), layout.scenes, layout.sceneWidth);

    expect(segments).toEqual([
      { x1: cellEnd(0, layout.sceneWidth), x2: cellStart(1, layout.sceneWidth), isGap: false },
    ]);
  });
});

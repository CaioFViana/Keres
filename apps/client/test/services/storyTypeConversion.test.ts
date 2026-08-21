import {
  classifyEdges,
  computeChapterChainOrder,
  groupScenesByChapter,
  type ChapterWithScenes,
  type Edge,
} from '../../src/services/storymanagement/storyTypeConversion';

const chapter = (id: string, index: number, name = `Capítulo ${index}`) =>
  ({ id, index, name }) as any;
const scene = (id: string, chapterId: string, index: number) => ({ id, chapterId, index }) as any;
const edge = (sceneId: string, nextSceneId: string): Edge => ({ sceneId, nextSceneId });

/**
 * Estas três funções decidem se uma história Branching pode virar Linear. Um falso positivo
 * converte uma história ramificada e perde caminhos; um falso negativo bloqueia uma conversão
 * legítima sem explicação útil.
 */
describe('groupScenesByChapter', () => {
  it('orders the scenes of each chapter by index, not by insertion', () => {
    const grouped = groupScenesByChapter(
      [chapter('c1', 1)],
      [scene('s3', 'c1', 3), scene('s1', 'c1', 1), scene('s2', 'c1', 2)],
    );

    expect(grouped[0].scenes.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('keeps the chapters in the order they were given', () => {
    const grouped = groupScenesByChapter(
      [chapter('c1', 1), chapter('c2', 2)],
      [scene('s2', 'c2', 1), scene('s1', 'c1', 1)],
    );

    expect(grouped.map((entry) => entry.chapter.id)).toEqual(['c1', 'c2']);
  });

  it('drops chapters with no scenes, since they cannot take part in a chain', () => {
    const grouped = groupScenesByChapter(
      [chapter('c1', 1), chapter('vazio', 2)],
      [scene('s1', 'c1', 1)],
    );

    expect(grouped.map((entry) => entry.chapter.id)).toEqual(['c1']);
  });

  it('ignores a scene whose chapter is not in the list', () => {
    const grouped = groupScenesByChapter(
      [chapter('c1', 1)],
      [scene('s1', 'c1', 1), scene('orfa', 'sumiu', 1)],
    );

    expect(grouped[0].scenes.map((s) => s.id)).toEqual(['s1']);
  });

  it('returns nothing for a story with no chapters', () => {
    expect(groupScenesByChapter([], [])).toEqual([]);
  });
});

describe('classifyEdges', () => {
  /** Duas cenas por capítulo, dois capítulos - o mínimo para exercitar as arestas cruzadas. */
  const twoChapters = (): ChapterWithScenes[] =>
    groupScenesByChapter(
      [chapter('c1', 1), chapter('c2', 2)],
      [scene('s1', 'c1', 1), scene('s2', 'c1', 2), scene('s3', 'c2', 1), scene('s4', 'c2', 2)],
    );

  it('groups intra-chapter edges under their own chapter', () => {
    const { intraEdgesByChapter } = classifyEdges(twoChapters(), [
      edge('s1', 's2'),
      edge('s3', 's4'),
    ]);

    expect(intraEdgesByChapter.get('c1')).toEqual([edge('s1', 's2')]);
    expect(intraEdgesByChapter.get('c2')).toEqual([edge('s3', 's4')]);
  });

  it('accepts the edge that links the end of a chapter to the start of the next', () => {
    const { illegitimateCrossChapterSourceChapters } = classifyEdges(twoChapters(), [
      edge('s2', 's3'),
    ]);

    expect(illegitimateCrossChapterSourceChapters.size).toBe(0);
  });

  it('rejects a cross-chapter edge that does not leave from the last scene', () => {
    const { illegitimateCrossChapterSourceChapters } = classifyEdges(twoChapters(), [
      edge('s1', 's3'),
    ]);

    expect([...illegitimateCrossChapterSourceChapters]).toEqual(['c1']);
  });

  it('rejects a cross-chapter edge that does not land on the first scene', () => {
    const { illegitimateCrossChapterSourceChapters } = classifyEdges(twoChapters(), [
      edge('s2', 's4'),
    ]);

    expect([...illegitimateCrossChapterSourceChapters]).toEqual(['c1']);
  });

  it('rejects an edge that skips a chapter', () => {
    const chapters = groupScenesByChapter(
      [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)],
      [scene('s1', 'c1', 1), scene('s2', 'c2', 1), scene('s3', 'c3', 1)],
    );

    const { illegitimateCrossChapterSourceChapters } = classifyEdges(chapters, [edge('s1', 's3')]);

    expect([...illegitimateCrossChapterSourceChapters]).toEqual(['c1']);
  });

  it('rejects an edge going back to an earlier chapter', () => {
    const { illegitimateCrossChapterSourceChapters } = classifyEdges(twoChapters(), [
      edge('s4', 's1'),
    ]);

    expect([...illegitimateCrossChapterSourceChapters]).toEqual(['c2']);
  });

  it('treats an empty chapter as absent when deciding what is consecutive', () => {
    const chapters = groupScenesByChapter(
      [chapter('c1', 1), chapter('vazio', 2), chapter('c3', 3)],
      [scene('s1', 'c1', 1), scene('s2', 'c3', 1)],
    );

    const { illegitimateCrossChapterSourceChapters } = classifyEdges(chapters, [edge('s1', 's2')]);

    expect(illegitimateCrossChapterSourceChapters.size).toBe(0);
  });

  it('ignores a choice pointing at a scene that no longer exists', () => {
    const { intraEdgesByChapter, illegitimateCrossChapterSourceChapters } = classifyEdges(
      twoChapters(),
      [edge('s1', 'sumiu'), edge('sumiu', 's1')],
    );

    expect(intraEdgesByChapter.size).toBe(0);
    expect(illegitimateCrossChapterSourceChapters.size).toBe(0);
  });

  it('reports a chapter with several bad edges only once', () => {
    const { illegitimateCrossChapterSourceChapters } = classifyEdges(twoChapters(), [
      edge('s1', 's3'),
      edge('s1', 's4'),
    ]);

    expect([...illegitimateCrossChapterSourceChapters]).toEqual(['c1']);
  });

  it('reports nothing for a story with no choices', () => {
    const { intraEdgesByChapter, illegitimateCrossChapterSourceChapters } = classifyEdges(
      twoChapters(),
      [],
    );

    expect(intraEdgesByChapter.size).toBe(0);
    expect(illegitimateCrossChapterSourceChapters.size).toBe(0);
  });
});

describe('computeChapterChainOrder', () => {
  it('follows the chain from the scene nothing points at', () => {
    const scenes = [scene('s3', 'c1', 3), scene('s1', 'c1', 1), scene('s2', 'c1', 2)];
    const edges = [edge('s1', 's2'), edge('s2', 's3')];

    expect(computeChapterChainOrder(scenes, edges)).toEqual(['s1', 's2', 's3']);
  });

  it('follows the chain order, not the stored scene index', () => {
    const scenes = [scene('s1', 'c1', 1), scene('s2', 'c1', 2), scene('s3', 'c1', 3)];
    const edges = [edge('s3', 's1'), edge('s1', 's2')];

    expect(computeChapterChainOrder(scenes, edges)).toEqual(['s3', 's1', 's2']);
  });

  it('returns the single scene of a chapter with no choices', () => {
    expect(computeChapterChainOrder([scene('s1', 'c1', 1)], [])).toEqual(['s1']);
  });

  it('returns an empty order for a chapter with no scenes', () => {
    expect(computeChapterChainOrder([], [])).toEqual([]);
  });

  /**
   * A ordem só cobre a cadeia que sai da cena inicial; uma cena desligada fica de fora. É por
   * isso que `checkLinearCompatibility` rejeita o capítulo com `orphan` antes: chamar esta
   * função sem aquela checagem perderia a cena solta na conversão.
   */
  it('leaves out a scene that is not on the chain', () => {
    const scenes = [scene('s1', 'c1', 1), scene('s2', 'c1', 2), scene('solta', 'c1', 3)];

    expect(computeChapterChainOrder(scenes, [edge('s1', 's2')])).toEqual(['s1', 's2']);
  });

  it('refuses a cycle rather than looping forever', () => {
    const scenes = [scene('s1', 'c1', 1), scene('s2', 'c1', 2)];
    const edges = [edge('s1', 's2'), edge('s2', 's1')];

    expect(() => computeChapterChainOrder(scenes, edges)).toThrow(/no valid chain start/);
  });
});

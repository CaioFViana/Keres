import type { ChapterSelect, SceneSelect } from '../db/schema';

/**
 * A ordem em que as cenas de uma história linear são lidas: capítulo primeiro, cena depois.
 *
 * Existe uma função só porque detalhe de Plot, Leitor, Matriz e Cobertura precisam concordar
 * sobre "a próxima cena". Cada tela ordenando por conta própria já foi o suficiente para a
 * mesma história aparecer em duas ordens diferentes em telas vizinhas.
 *
 * Cenas de capítulo desconhecido (capítulo apagado, importação incompleta) vão para o fim em
 * vez de sumirem: elas continuam sendo cenas da história.
 */
export function compareNarrativeScenes(
  chapters: Pick<ChapterSelect, 'id' | 'index'>[],
): (a: Pick<SceneSelect, 'chapterId' | 'index'>, b: Pick<SceneSelect, 'chapterId' | 'index'>) => number {
  const chapterIndex = new Map(chapters.map((chapter) => [chapter.id, chapter.index]));
  const indexOf = (chapterId: string) => chapterIndex.get(chapterId) ?? Number.MAX_SAFE_INTEGER;
  return (a, b) => indexOf(a.chapterId) - indexOf(b.chapterId) || a.index - b.index;
}

export function sortScenesNarratively<T extends Pick<SceneSelect, 'chapterId' | 'index'>>(
  scenes: T[],
  chapters: Pick<ChapterSelect, 'id' | 'index'>[],
): T[] {
  return [...scenes].sort(compareNarrativeScenes(chapters));
}

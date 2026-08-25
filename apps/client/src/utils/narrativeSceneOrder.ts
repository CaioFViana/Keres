import type { ChapterSelect, SceneSelect } from '../db/schema';

/**
 * The order in which a linear story's scenes are read: chapter first, scene second.
 *
 * There is a single function only because a Plot's detail, the Reader, the Matrix and the Coverage need to agree
 * about "the next scene". Each screen sorting on its own was already enough for the
 * same story to appear in two different orders on neighbouring screens.
 *
 * Scenes with an unknown chapter (a deleted chapter, an incomplete import) go to the end instead
 * of disappearing: they are still the story's scenes.
 */
export function compareNarrativeScenes(
  chapters: Pick<ChapterSelect, 'id' | 'index'>[],
): (
  a: Pick<SceneSelect, 'chapterId' | 'index'>,
  b: Pick<SceneSelect, 'chapterId' | 'index'>,
) => number {
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

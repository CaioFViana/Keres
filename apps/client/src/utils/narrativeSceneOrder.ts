import type { ChapterSelect, SceneSelect } from '../db/schema';

/** Sentinel id for the list bucket of scenes that belong to no chapter. Not a stored row. */
export const UNCHAPTERED_GROUP_ID = '__unchaptered__';

export function isUnchapteredGroup(id: string | null | undefined): boolean {
  return id === UNCHAPTERED_GROUP_ID;
}

/**
 * The order in which a linear story's scenes are read: chapter first, scene second.
 *
 * There is a single function only because a Plot's detail, the Reader, the Matrix and the Coverage need to agree
 * about "the next scene". Each screen sorting on its own was already enough for the
 * same story to appear in two different orders on neighbouring screens.
 *
 * Scenes with no chapter (a fragment, or a deleted chapter / incomplete import) go to the end
 * instead of disappearing: they are still the story's scenes. Among themselves they sort by name,
 * because they have no 1..N of their own.
 */
export function compareNarrativeScenes(
  chapters: Pick<ChapterSelect, 'id' | 'index'>[],
): (
  a: Pick<SceneSelect, 'chapterId' | 'index' | 'name'>,
  b: Pick<SceneSelect, 'chapterId' | 'index' | 'name'>,
) => number {
  const chapterIndex = new Map(chapters.map((chapter) => [chapter.id, chapter.index]));
  const indexOf = (chapterId: string | null) =>
    chapterId ? (chapterIndex.get(chapterId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
  return (a, b) => {
    const byChapter = indexOf(a.chapterId) - indexOf(b.chapterId);
    if (byChapter !== 0) return byChapter;
    if (!a.chapterId && !b.chapterId) return a.name.localeCompare(b.name);
    return a.index - b.index;
  };
}

export function sortScenesNarratively<T extends Pick<SceneSelect, 'chapterId' | 'index' | 'name'>>(
  scenes: T[],
  chapters: Pick<ChapterSelect, 'id' | 'index'>[],
): T[] {
  return [...scenes].sort(compareNarrativeScenes(chapters));
}

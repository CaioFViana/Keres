/**
 * Which containers and scenes belong in the current Arc view.
 *
 * A specific Arc only shows chapters and events assigned to it. Unchaptered scenes stay visible
 * because they have no container to inherit from; they still appear under "All".
 */
export function chapterBelongsToArc(
  chapter: { arcId?: string | null },
  activeArcId: string | null,
): boolean {
  if (!activeArcId) return true;
  return chapter.arcId === activeArcId;
}

export function sceneBelongsToActiveArc(
  scene: { chapterId?: string | null },
  chaptersById: ReadonlyMap<string, { arcId?: string | null }>,
  activeArcId: string | null,
): boolean {
  if (!activeArcId) return true;
  if (!scene.chapterId) return true;
  const chapter = chaptersById.get(scene.chapterId);
  if (!chapter) return true;
  return chapterBelongsToArc(chapter, activeArcId);
}

export function resolveEffectiveTheme(
  storyTheme: string | null | undefined,
  arcThemeOverride: string | null | undefined,
): string {
  return arcThemeOverride || storyTheme || 'default';
}

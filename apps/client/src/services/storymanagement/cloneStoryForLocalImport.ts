import type { FullStoryExportType } from '@keres/shared';
import { cloneExampleStoryForInstall } from '../../exampleStories/cloneExampleStory';

/**
 * Gives a file import its own identity graph. This intentionally shares the remapping
 * implementation used by the bundled catalog so every internal reference stays intact.
 */
export function cloneStoryForLocalImport(
  story: FullStoryExportType,
  userId: string,
  targetStoryId?: string,
): FullStoryExportType {
  return cloneExampleStoryForInstall(story, userId, targetStoryId);
}

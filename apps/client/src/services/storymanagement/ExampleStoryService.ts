import { FullStoryExportSchema, reviveDates } from '@keres/shared';
import type { AppDrizzleClient } from '../../db';
import { exampleStoryRegistry } from '../../exampleStories/generated/registry';
import type { ExampleStoryEntry } from '../../exampleStories/types';
import { createStoryService } from './StoryService';

/**
 * Installs an example story (packaged with the app) into the user's repertoire.
 *
 * It reuses the same story import/export infrastructure instead of duplicating it: each example's
 * content is already in the `FullStoryExportSchema` format (the same as an exported
 * `.json` file), so "installing" is literally "importing" - checking whether the story already
 * exists (the same check as `ImportExportScreen`) and calling `importFullStory`. Examples have
 * no media (see `exampleStories/`), so there is nothing equivalent to the `.zip` flow.
 */

export type InstallExampleStoryResult =
  | { status: 'installed'; storyId: string }
  | { status: 'not_found' }
  | { status: 'invalid_content' };

export interface ExampleStoryServiceInterface {
  listExampleStories(): ExampleStoryEntry[];
  installExampleStory(
    userId: string,
    slug: string,
    language: string,
  ): Promise<InstallExampleStoryResult>;
}

export const createExampleStoryService = (db: AppDrizzleClient): ExampleStoryServiceInterface => {
  const storyService = createStoryService(db);

  return {
    listExampleStories(): ExampleStoryEntry[] {
      return exampleStoryRegistry;
    },

    async installExampleStory(
      userId: string,
      slug: string,
      language: string,
    ): Promise<InstallExampleStoryResult> {
      const entry = exampleStoryRegistry.find((candidate) => candidate.slug === slug);
      const languageEntry = entry?.languages.find((candidate) => candidate.language === language);
      if (!languageEntry) {
        console.error(`ExampleStoryService: example story not found: ${slug}/${language}.`);
        return { status: 'not_found' };
      }

      // The packaged JSON never had its dates revived (it is a static `import` of a `.json`,
      // just like the `JSON.parse` of a file chosen by the user) - the same care as
      // `pickStoryExportFile`.
      const parsed = FullStoryExportSchema.safeParse(reviveDates(languageEntry.story));
      if (!parsed.success) {
        console.error(
          `ExampleStoryService: bundled content for ${slug}/${language} failed validation.`,
          parsed.error,
        );
        return { status: 'invalid_content' };
      }

      // The local import creates the copy and remaps its IDs, examples included.
      const storyId = await storyService.importFullStory(userId, parsed.data, null);
      return { status: 'installed', storyId };
    },
  };
};

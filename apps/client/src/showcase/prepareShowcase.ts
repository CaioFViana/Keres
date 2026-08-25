import type { AppDrizzleClient } from '../db';
import { createClientSettings, getClientSettings } from '../services/ClientSettingsService';
import { exampleStoryRegistry } from '../exampleStories/generated/registry';
import { createExampleStoryService } from '../services/storymanagement/ExampleStoryService';
import { createStoryService } from '../services/storymanagement/StoryService';
import type { Story } from '@keres/shared/entities/Story';
import { useStoryStore } from '../state/storyStore';
import { useThemeStore } from '../state/themeStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import i18n from '../utils/i18n';
import type { ShowcaseRequest } from './showcaseRequest';

/**
 * Gets the app ready for the capture: language, theme, an example story installed and selected.
 *
 * It reuses the normal installation path (`installExampleStory`), so the story the image shows is the
 * same one a person gets when installing the example from the menu - with ids remapped and everything.
 */
export async function prepareShowcase(
  db: AppDrizzleClient,
  request: ShowcaseRequest,
): Promise<boolean> {
  try {
    await i18n.changeLanguage(request.language);

    // A clean profile: the capture runs in a fresh directory every time, so the showcase does on its own
    // what the opening screen would do - otherwise the first image would be the welcome one.
    if (!(await getClientSettings(db))) {
      await createClientSettings(db, {
        localUsername: 'Keres',
        language: request.language,
        darkMode: request.theme === 'dark',
        use24HourTime: true,
        showContextualHelp: true,
        suggestLiteraryDevices: true,
      });
    }
    await useUserSettingsStore.getState().initializeSettings(db);

    const userId = useUserSettingsStore.getState().userId;
    if (!userId) {
      console.warn('[showcase] sem usuário local depois de criar as configurações.');
      return false;
    }

    await useThemeStore.getState().setDarkMode(db, request.theme === 'dark');

    const storyService = createStoryService(db);
    // The packaged example's title identifies the installed story. Searching by language alone made the
    // second photo reuse the first one's story - every screen came out of the same story, regardless of
    // which was requested.
    const packaged = exampleStoryRegistry
      .find((entry) => entry.slug === request.story)
      ?.languages.find((entry) => entry.language === request.language)?.story as
      | { story?: { title?: string } }
      | undefined;
    const expectedTitle = packaged?.story?.title;
    const existing = (await storyService.getAllStories(userId)).find(
      (story) => !story.isDeleted && story.title === expectedTitle,
    );
    const target =
      existing ??
      (await (async () => {
        const result = await createExampleStoryService(db).installExampleStory(
          userId,
          request.story,
          request.language,
        );
        if (result.status !== 'installed') {
          console.error('[showcase] não foi possível instalar o exemplo:', result.status);
          return undefined;
        }
        return storyService.getStoryById(result.storyId, userId);
      })());

    if (!target) return false;
    // The service returns the database row, with the fields open as text; the store holds the entity. The
    // values are the same - only the type is narrower.
    useStoryStore.getState().setSelectedStory(target as unknown as Story);
    // A flag for the capturer: the data is ready. It still waits a settling time for the drawing, but it no
    // longer has to guess from the screen's text - that was what made a photo come out on the loading
    // screen every now and then.
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.keresShowcase = 'ready';
    }
    return true;
  } catch (error) {
    console.error('[showcase] falha ao preparar a vitrine:', error);
    return false;
  }
}

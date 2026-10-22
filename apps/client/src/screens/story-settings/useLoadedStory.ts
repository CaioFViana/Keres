import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '@/src/db';
import { createStoryService } from '@/src/services/storymanagement/story-lifecycle/StoryService';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { logger } from '@/src/utils/logging/logger';

type LoadedStory = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createStoryService>['getStoryById']>>
>;

/**
 * Reads the selected story from the database for a settings section and hands it to `onLoad` once, so the
 * section can seed its own fields. The callback may change between renders without reading the story again.
 */
export function useLoadedStory(onLoad: (story: LoadedStory) => void) {
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const storyService = useMemo(() => createStoryService(drizzleDb), [drizzleDb]);
  const onLoadRef = useRef(onLoad);
  useLayoutEffect(() => {
    onLoadRef.current = onLoad;
  });
  const [state, setState] = useState<{ loading: boolean; error: string | null }>({
    loading: true,
    error: null,
  });

  const [prevStoryId, setPrevStoryId] = useState<typeof storyId | null>(null);
  if (storyId !== prevStoryId) {
    setPrevStoryId(storyId);
    if (!storyId) setState({ loading: false, error: null });
  }

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    const load = async () => {
      try {
        setState({ loading: true, error: null });
        const story = await storyService.getStoryById(storyId, userId ?? undefined);
        if (cancelled) return;
        if (!story) {
          setState({ loading: false, error: t('story_not_found') });
          return;
        }
        onLoadRef.current(story);
        setState({ loading: false, error: null });
      } catch (err) {
        logger.error('Failed to load story settings:', err);
        if (!cancelled) setState({ loading: false, error: t('failed_to_load_story_settings') });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [storyId, storyService, userId, t]);

  return state;
}

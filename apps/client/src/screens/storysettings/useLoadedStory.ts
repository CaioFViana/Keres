import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../../db';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';

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
        console.error('Failed to load story settings:', err);
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

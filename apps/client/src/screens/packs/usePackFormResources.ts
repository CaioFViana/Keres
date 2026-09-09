import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../../db';
import type { StorySelect } from '../../db/schema';
import { createPackService, type PackService } from '../../services/storymanagement/PackService';
import { createStoryService, type StoryService } from '../../services/storymanagement/StoryService';
import { useNotificationStore } from '../../state/notificationStore';

/** Owns pack/story services and the source-story lookup list. */
export function usePackFormResources(userId?: string | null) {
  const drizzleDb = useDrizzle();
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const packServiceRef = useRef<PackService | null>(null);
  const storyServiceRef = useRef<StoryService | null>(null);
  const [stories, setStories] = useState<StorySelect[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);

  useEffect(() => {
    packServiceRef.current ??= createPackService(drizzleDb);
    storyServiceRef.current ??= createStoryService(drizzleDb);
  }, [drizzleDb]);

  useEffect(() => {
    (async () => {
      try {
        if (!storyServiceRef.current) {
          storyServiceRef.current = createStoryService(drizzleDb);
        }
        const list = await storyServiceRef.current.getAllStories(userId ?? undefined);
        setStories(list);
      } catch (error) {
        console.error('PackFormScreen: failed to load.', error);
        showNotification(t('packs_load_failed'), 'error');
      } finally {
        setStoriesLoading(false);
      }
    })();
  }, [drizzleDb, userId, showNotification, t]);

  return {
    drizzleDb,
    packServiceRef,
    storyServiceRef,
    stories,
    storiesLoading,
  };
}

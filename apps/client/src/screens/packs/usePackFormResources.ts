import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '@/src/db';
import type { StorySelect } from '@/src/db/schema';
import {
  createPackService,
  type PackService,
} from '@/src/services/storymanagement/packs/PackService';
import {
  createStoryService,
  type StoryService,
} from '@/src/services/storymanagement/story-lifecycle/StoryService';
import { useNotificationStore } from '@/src/state/ui/notificationStore';
import { logger } from '@/src/utils/logging/logger';
import { fireAndLog } from '@/src/utils/logging/fireAndLog';

/** Owns pack/story services and the source-story lookup list. */
export function usePackFormResources(userId?: string | null) {
  const drizzleDb = useDrizzle();
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const packServiceRef = useRef<PackService | null>(null);
  const storyServiceRef = useRef<StoryService | null>(null);
  const [stories, setStories] = useState<StorySelect[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);

  // Created in the first render, not after it: no screen can look for a service that is not there yet.
  packServiceRef.current ??= createPackService(drizzleDb);
  storyServiceRef.current ??= createStoryService(drizzleDb);

  useEffect(() => {
    fireAndLog(
      (async () => {
        try {
          if (!storyServiceRef.current) {
            storyServiceRef.current = createStoryService(drizzleDb);
          }
          const list = await storyServiceRef.current.getAllStories(userId ?? undefined);
          setStories(list);
        } catch (error) {
          logger.error('PackFormScreen: failed to load.', error);
          showNotification(t('packs_load_failed'), 'error');
        } finally {
          setStoriesLoading(false);
        }
      })(),
      'usePackFormResources',
    );
  }, [drizzleDb, userId, showNotification, t]);

  return {
    drizzleDb,
    packServiceRef,
    storyServiceRef,
    stories,
    storiesLoading,
  };
}

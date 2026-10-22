import { useEffect, useState } from 'react';
import { useDrizzle } from '@/src/db';
import {
  createStoryEntityCountService,
  type StoryEntityUsage,
} from '@/src/services/storymanagement/story-lifecycle/StoryEntityCountService';
import { logger } from '@/src/utils/logging/logger';

/**
 * The person's own stories on a server with their local entity counts, read again each time `active`
 * turns true (the screen comes back to the front after the person wrote somewhere else). Nothing is
 * shown for a count that cannot be read: it is information beside the plan, never worth an error.
 */
export function useServerStoryUsage(serverId: string | undefined, active: boolean) {
  const db = useDrizzle();
  const [stories, setStories] = useState<StoryEntityUsage[]>([]);

  useEffect(() => {
    if (!serverId || !active) return;
    let cancelled = false;
    createStoryEntityCountService(db)
      .countOwnedOnServer(serverId)
      .then((usage) => {
        if (!cancelled) setStories(usage);
      })
      .catch((error) => {
        logger.warn('useServerStoryUsage: could not count the stories.', error);
        if (!cancelled) setStories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [db, serverId, active]);

  return { stories };
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EntityEventName } from '@/src/state/events/entityEvents';
import { logger } from '@/src/utils/logging/logger';
import { useEntityEventSubscriptions, useEntityInitialLoad } from './useEntityRefreshLifecycle';

const NO_ENTITIES: never[] = [];

interface StoryEntitiesOptions<T> {
  /** The story whose rows are listed. Without one the list is empty. */
  storyId: string | undefined;
  /** Reads the story's rows. Must be stable (service methods already hold the database). */
  load: (storyId: string) => Promise<T[]>;
  /** Events that reload the list when they report a change in this story. Must be stable. */
  events: readonly EntityEventName[];
  /** Names the list in the log line when the read fails. */
  label: string;
  /**
   * For a list that belongs to one entity (its relations, say): the events reload it only when they
   * name this entity in this story, instead of any change in the story.
   */
  entityId?: string;
  /** Holds the first read back, for lists that only matter once the screen's own record is there. */
  enabled?: boolean;
}

/**
 * A read-only list of every row of a kind in one story, kept fresh by entity events.
 *
 * A reload that answers after a newer one (or after the story changed, or the screen left) is
 * dropped, so a slow read can never overwrite fresher rows. A failed read keeps the last rows and
 * is logged. Rows of another story are never returned, even for the render between a story change
 * and the first read.
 */
export function useStoryEntities<T>({
  storyId,
  load,
  events,
  label,
  entityId,
  enabled = true,
}: StoryEntitiesOptions<T>): T[] {
  const [loaded, setLoaded] = useState<{ storyId: string; rows: T[] } | null>(null);
  const generation = useRef(0);

  const reload = useCallback(async () => {
    if (!storyId || !enabled) return;
    const current = ++generation.current;
    try {
      const rows = await load(storyId);
      if (current === generation.current) setLoaded({ storyId, rows });
    } catch (error) {
      logger.error(`Failed to fetch ${label}:`, error);
    }
  }, [storyId, enabled, load, label]);

  useEntityInitialLoad(reload);
  // Whatever is still in flight when the read changes or the screen leaves no longer counts.
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [reload],
  );

  const subscriptions = useMemo(
    () =>
      events.map((event) => ({
        event,
        listener: (changedStoryId: string, changedEntityId?: string) => {
          const mine =
            changedStoryId === storyId && (entityId === undefined || changedEntityId === entityId);
          if (mine) void reload();
        },
      })),
    [events, storyId, entityId, reload],
  );
  useEntityEventSubscriptions(subscriptions);

  return enabled && loaded && loaded.storyId === storyId ? loaded.rows : NO_ENTITIES;
}

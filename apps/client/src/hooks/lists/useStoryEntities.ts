import { useMemo } from 'react';
import type { EntityEventName } from '@/src/state/events/entityEvents';
import { useLoadedResource } from './useLoadedResource';

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
 * A read-only list of every row of a kind in one story, kept fresh by entity events (see
 * `useLoadedResource` for how reads are guarded). Rows of another story are never returned, even
 * for the render between a story change and the first read.
 *
 * Besides the rows it says whether the first read failed (`failed`: "could not read" is not
 * "empty") and hands out `reload` for the screens that change the list themselves.
 */
export function useStoryList<T>({
  storyId,
  load,
  events,
  label,
  entityId,
  enabled = true,
}: StoryEntitiesOptions<T>) {
  const read = useMemo(
    () => (storyId && enabled ? () => load(storyId) : null),
    [storyId, enabled, load],
  );
  const { data, loading, failed, reload } = useLoadedResource<T[]>({
    load: read,
    initial: NO_ENTITIES,
    events,
    storyId,
    entityId,
    label,
  });
  return { items: data, loading, failed, reload };
}

/** The rows of `useStoryList`, for the callers that need nothing else. */
export function useStoryEntities<T>(options: StoryEntitiesOptions<T>): T[] {
  return useStoryList(options).items;
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type { TagSelect } from '../db/schema';
import { createTagService } from '../services/storymanagement/TagService';
import { entityEventEmitter } from '../utils/EventEmitter';

/**
 * The story's tags as the options of a list's tag filter. Fetched here rather than by the list hook,
 * and refetched whenever a tag of the story changes.
 */
export function useStoryTagFilterOptions(storyId: string | undefined) {
  const drizzleDb = useDrizzle();
  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const [tagService] = useState(() => createTagService(drizzleDb));

  const fetchTags = useCallback(async () => {
    if (!storyId) {
      setAllTags([]);
      return;
    }
    try {
      const fetchedTags = await tagService.getTagsByStoryId(storyId);
      setAllTags(fetchedTags);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  }, [storyId, tagService]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `fetchTags` clears synchronously only when no story is selected; everything else waits for `await`. The rule cannot verify across the callback boundary.
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    const handleTagChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) fetchTags();
    };
    entityEventEmitter.on('tag_changed', handleTagChange);
    return () => entityEventEmitter.off('tag_changed', handleTagChange);
  }, [fetchTags, storyId]);

  return useMemo(
    () => allTags.map((tag: TagSelect) => ({ label: tag.name, value: tag.id, color: tag.color })),
    [allTags],
  );
}

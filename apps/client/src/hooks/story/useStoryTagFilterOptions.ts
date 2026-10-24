import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import type { TagSelect } from '@/src/db/schema';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { createTagService } from '@/src/services/storymanagement/notes-tags-comments/TagService';

const NO_TAGS: TagSelect[] = [];
const TAG_EVENTS = ['tag_changed'] as const;

/**
 * The story's tags as the options of a list's tag filter. Fetched here rather than by the list hook,
 * and refetched whenever a tag of the story changes.
 */
export function useStoryTagFilterOptions(storyId: string | undefined) {
  const drizzleDb = useDrizzle();
  const tagService = useMemo(() => createTagService(drizzleDb), [drizzleDb]);
  const load = useMemo(
    () => (storyId ? () => tagService.getTagsByStoryId(storyId) : null),
    [tagService, storyId],
  );
  const { data: allTags } = useLoadedResource({
    load,
    initial: NO_TAGS,
    events: TAG_EVENTS,
    storyId,
    label: 'tags',
  });

  return useMemo(
    () => allTags.map((tag: TagSelect) => ({ label: tag.name, value: tag.id, color: tag.color })),
    [allTags],
  );
}

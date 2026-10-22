import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import { createTagService } from '@/src/services/storymanagement/notes-tags-comments/TagService';
import { createTagRelationService } from '@/src/services/storymanagement/relations/TagRelationService';

/** The services the tag detail talks to: the record, and what it is attached to. */
export function useTagDetailServices() {
  const drizzleDb = useDrizzle();
  return useMemo(
    () => ({
      tagService: createTagService(drizzleDb),
      tagRelationService: createTagRelationService(drizzleDb),
    }),
    [drizzleDb],
  );
}

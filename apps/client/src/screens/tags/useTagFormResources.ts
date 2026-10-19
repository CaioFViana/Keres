import { useEffect, useRef } from 'react';
import { useDrizzle } from '@/src/db';
import {
  createTagService,
  type TagService,
} from '@/src/services/storymanagement/notes-tags-comments/TagService';

/** Owns the tag service used by the form. */
export function useTagFormResources() {
  const drizzleDb = useDrizzle();
  const tagServiceRef = useRef<TagService | null>(null);

  useEffect(() => {
    tagServiceRef.current ??= createTagService(drizzleDb);
  }, [drizzleDb]);

  return {
    drizzleDb,
    tagServiceRef,
  };
}

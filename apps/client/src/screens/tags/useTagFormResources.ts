import { useRef } from 'react';
import { useDrizzle } from '@/src/db';
import {
  createTagService,
  type TagService,
} from '@/src/services/storymanagement/notes-tags-comments/TagService';

/** Owns the tag service used by the form. */
export function useTagFormResources() {
  const drizzleDb = useDrizzle();
  const tagServiceRef = useRef<TagService | null>(null);

  // Created in the first render, not after it: no screen can look for a service that is not there yet.
  tagServiceRef.current ??= createTagService(drizzleDb);

  return {
    drizzleDb,
    tagServiceRef,
  };
}

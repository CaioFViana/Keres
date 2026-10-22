import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import { createNoteService } from '@/src/services/storymanagement/notes-tags-comments/NoteService';
import { createNoteRelationService } from '@/src/services/storymanagement/relations/NoteRelationService';
import { createTagRelationService } from '@/src/services/storymanagement/relations/TagRelationService';

/** The services the note detail talks to: the record, what it links to, and its tags. */
export function useNoteDetailServices() {
  const drizzleDb = useDrizzle();
  return useMemo(
    () => ({
      noteService: createNoteService(drizzleDb),
      noteRelationService: createNoteRelationService(drizzleDb),
      tagRelationService: createTagRelationService(drizzleDb),
    }),
    [drizzleDb],
  );
}

export type NoteDetailServices = ReturnType<typeof useNoteDetailServices>;

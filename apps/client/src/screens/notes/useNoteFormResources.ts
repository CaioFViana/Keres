import { useEffect, useRef } from 'react';
import { useDrizzle } from '@/src/db';
import {
  createNoteService,
  type NoteService,
} from '@/src/services/storymanagement/notes-tags-comments/NoteService';

/** Owns the note service used by the form. */
export function useNoteFormResources() {
  const drizzleDb = useDrizzle();
  const noteServiceRef = useRef<NoteService | null>(null);

  useEffect(() => {
    noteServiceRef.current ??= createNoteService(drizzleDb);
  }, [drizzleDb]);

  return {
    drizzleDb,
    noteServiceRef,
  };
}

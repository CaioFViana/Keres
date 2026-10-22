import { useRef } from 'react';
import { useDrizzle } from '@/src/db';
import {
  createNoteService,
  type NoteService,
} from '@/src/services/storymanagement/notes-tags-comments/NoteService';

/** Owns the note service used by the form. */
export function useNoteFormResources() {
  const drizzleDb = useDrizzle();
  const noteServiceRef = useRef<NoteService | null>(null);

  // Created in the first render, not after it: no screen can look for a service that is not there yet.
  noteServiceRef.current ??= createNoteService(drizzleDb);

  return {
    drizzleDb,
    noteServiceRef,
  };
}

import { useEffect, useRef } from 'react';
import { useDrizzle } from '../../db';
import { createNoteService, type NoteService } from '../../services/storymanagement/NoteService';

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

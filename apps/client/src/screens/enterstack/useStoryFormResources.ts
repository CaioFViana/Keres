import { useEffect, useRef, useState } from 'react';
import { useDrizzle } from '../../db';
import {
  createPackService,
  type PackService,
  type PackSummary,
} from '../../services/storymanagement/PackService';
import { createStoryService, type StoryService } from '../../services/storymanagement/StoryService';

/** Owns the story and pack services plus create-mode pack lookups. */
export function useStoryFormResources(initialStoryId?: string) {
  const drizzleDb = useDrizzle();
  const storyServiceRef = useRef<StoryService | null>(null);
  const packServiceRef = useRef<PackService | null>(null);
  const [packs, setPacks] = useState<PackSummary[]>([]);

  useEffect(() => {
    storyServiceRef.current ??= createStoryService(drizzleDb);
    packServiceRef.current ??= createPackService(drizzleDb);
  }, [drizzleDb]);

  useEffect(() => {
    // Packs are offered only while creating: applying one to an existing story would mean writing its
    // contents as ordinary edits, which is exactly the operation-log flood the design avoids.
    if (initialStoryId) return;
    createPackService(drizzleDb)
      .listPacks()
      .then(setPacks)
      .catch((err) => console.error('StoryFormScreen: failed to list packs.', err));
  }, [drizzleDb, initialStoryId]);

  return {
    drizzleDb,
    storyServiceRef,
    packServiceRef,
    packs,
  };
}

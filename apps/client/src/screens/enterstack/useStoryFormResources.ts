import { useEffect, useRef, useState } from 'react';
import { useDrizzle } from '../../db';
import {
  createPackService,
  type PackService,
  type PackSummary,
} from '../../services/storymanagement/PackService';
import { createStoryService, type StoryService } from '../../services/storymanagement/StoryService';
import { useShippedPacksInstallerStore } from '../../state/shippedPacksInstallerStore';

/** Owns the story and pack services plus create-mode pack lookups. */
export function useStoryFormResources(initialStoryId?: string) {
  const drizzleDb = useDrizzle();
  const storyServiceRef = useRef<StoryService | null>(null);
  const packServiceRef = useRef<PackService | null>(null);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  // Installing from the overlay's modal never refocuses this form, so the list it loaded on
  // mount would otherwise miss the newcomer. The installer reports each success here instead.
  const lastInstalledPackId = useShippedPacksInstallerStore((state) => state.lastInstalledPackId);

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
  }, [drizzleDb, initialStoryId, lastInstalledPackId]);

  return {
    drizzleDb,
    storyServiceRef,
    packServiceRef,
    packs,
  };
}

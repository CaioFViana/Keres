import { useEffect, useRef } from 'react';
import { useDrizzle } from '@/src/db';
import { createItemJourneyService } from '@/src/services/storymanagement/entities/ItemJourneyService';
import { useCharacterStore } from '@/src/state/story/characterStore';
import { useItemStore } from '@/src/state/story/itemStore';
import { useSceneStore } from '@/src/state/story/sceneStore';

/** Owns the item-journey service and the story-scoped lookup stores used by the form. */
export function useItemJourneyFormResources(storyId?: string) {
  const drizzleDb = useDrizzle();
  const itemJourneyServiceRef = useRef<ReturnType<typeof createItemJourneyService> | null>(null);
  const {
    items,
    fetchItems,
    setDbAndStoryId: setItemDbAndStoryId,
    initializeService: initializeItemService,
  } = useItemStore();
  const {
    scenes,
    fetchScenes,
    setDbAndStoryId: setSceneDbAndStoryId,
    initializeService: initializeSceneService,
  } = useSceneStore();
  const {
    characters,
    fetchCharacters,
    setDbAndStoryId: setCharacterDbAndStoryId,
    initializeService: initializeCharacterService,
  } = useCharacterStore();

  useEffect(() => {
    itemJourneyServiceRef.current ??= createItemJourneyService(drizzleDb);
  }, [drizzleDb]);

  useEffect(() => {
    if (!storyId) return;
    setItemDbAndStoryId(drizzleDb, storyId);
    initializeItemService();
    fetchItems();
    setSceneDbAndStoryId(drizzleDb, storyId);
    initializeSceneService();
    fetchScenes();
    setCharacterDbAndStoryId(drizzleDb, storyId);
    initializeCharacterService();
    fetchCharacters();
  }, [
    drizzleDb,
    storyId,
    setItemDbAndStoryId,
    initializeItemService,
    fetchItems,
    setSceneDbAndStoryId,
    initializeSceneService,
    fetchScenes,
    setCharacterDbAndStoryId,
    initializeCharacterService,
    fetchCharacters,
  ]);

  return {
    drizzleDb,
    itemJourneyServiceRef,
    items,
    scenes,
    characters,
  };
}

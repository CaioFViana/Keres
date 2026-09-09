import { useEffect, useRef } from 'react';
import { useDrizzle } from '../../../db';
import { createChoiceService } from '../../../services/storymanagement/ChoiceService';
import { useItemStore } from '../../../state/itemStore';
import { useSceneStore } from '../../../state/sceneStore';

/** Owns the choice service and the story-scoped lookup stores used by the form. */
export function useChoiceFormResources(storyId?: string) {
  const drizzleDb = useDrizzle();
  const choiceServiceRef = useRef<ReturnType<typeof createChoiceService> | null>(null);
  const {
    scenes,
    fetchScenes,
    setDbAndStoryId: setSceneDbAndStoryId,
    initializeService: initializeSceneService,
  } = useSceneStore();
  const {
    items,
    fetchItems,
    setDbAndStoryId: setItemDbAndStoryId,
    initializeService: initializeItemService,
  } = useItemStore();

  useEffect(() => {
    choiceServiceRef.current ??= createChoiceService(drizzleDb);
  }, [drizzleDb]);

  useEffect(() => {
    if (!storyId) return;
    setSceneDbAndStoryId(drizzleDb, storyId);
    initializeSceneService();
    fetchScenes();
    setItemDbAndStoryId(drizzleDb, storyId);
    initializeItemService();
    fetchItems();
  }, [
    drizzleDb,
    storyId,
    setSceneDbAndStoryId,
    initializeSceneService,
    fetchScenes,
    setItemDbAndStoryId,
    initializeItemService,
    fetchItems,
  ]);

  return {
    drizzleDb,
    choiceServiceRef,
    scenes,
    items,
  };
}

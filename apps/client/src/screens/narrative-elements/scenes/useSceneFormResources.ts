import { useEffect, useRef } from 'react';
import { useDrizzle } from '../../../db';
import { createSceneService } from '../../../services/storymanagement/SceneService';
import { useChapterStore } from '../../../state/chapterStore';
import { useCharacterStore } from '../../../state/characterStore';
import { useItemStore } from '../../../state/itemStore';
import { useLocationStore } from '../../../state/locationStore';

/** Owns the scene service and the story-scoped lookup stores used by the form. */
export function useSceneFormResources(storyId?: string) {
  const drizzleDb = useDrizzle();
  const sceneServiceRef = useRef<ReturnType<typeof createSceneService> | null>(null);
  const { chapters, fetchChapters, setDbAndStoryId: setChapterDb, initializeService: initChapter } =
    useChapterStore();
  const {
    locations,
    fetchLocations,
    setDbAndStoryId: setLocationDb,
    initializeService: initLocation,
  } = useLocationStore();
  const {
    characters,
    fetchCharacters,
    setDbAndStoryId: setCharacterDb,
    initializeService: initCharacter,
  } = useCharacterStore();
  const { items, fetchItems, setDbAndStoryId: setItemDb, initializeService: initItem } =
    useItemStore();

  useEffect(() => {
    sceneServiceRef.current ??= createSceneService(drizzleDb);
  }, [drizzleDb]);

  useEffect(() => {
    if (!storyId) return;
    setChapterDb(drizzleDb, storyId);
    initChapter();
    fetchChapters();
    setLocationDb(drizzleDb, storyId);
    initLocation();
    fetchLocations();
    setCharacterDb(drizzleDb, storyId);
    initCharacter();
    fetchCharacters();
    setItemDb(drizzleDb, storyId);
    initItem();
    fetchItems();
  }, [
    drizzleDb,
    storyId,
    setChapterDb,
    initChapter,
    fetchChapters,
    setLocationDb,
    initLocation,
    fetchLocations,
    setCharacterDb,
    initCharacter,
    fetchCharacters,
    setItemDb,
    initItem,
    fetchItems,
  ]);

  return {
    drizzleDb,
    sceneServiceRef,
    chapters,
    locations,
    characters,
    items,
  };
}

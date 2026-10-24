import { useEffect, useRef } from 'react';
import { useDrizzle } from '@/src/db';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';
import { useChapterStore } from '@/src/state/story/chapterStore';
import { useCharacterStore } from '@/src/state/story/characterStore';
import { useItemStore } from '@/src/state/story/itemStore';
import { useLocationStore } from '@/src/state/story/locationStore';

/** Owns the scene service and the story-scoped lookup stores used by the form. */
export function useSceneFormResources(storyId?: string) {
  const drizzleDb = useDrizzle();
  const sceneServiceRef = useRef<ReturnType<typeof createSceneService> | null>(null);
  const {
    chapters,
    fetchChapters,
    setDbAndStoryId: setChapterDb,
    initializeService: initChapter,
  } = useChapterStore();
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
  const {
    items,
    fetchItems,
    setDbAndStoryId: setItemDb,
    initializeService: initItem,
  } = useItemStore();

  // Created in the first render, not after it: no screen can look for a service that is not there yet.
  sceneServiceRef.current ??= createSceneService(drizzleDb);

  useEffect(() => {
    if (!storyId) return;
    setChapterDb(drizzleDb, storyId);
    initChapter();
    void fetchChapters();
    setLocationDb(drizzleDb, storyId);
    initLocation();
    void fetchLocations();
    setCharacterDb(drizzleDb, storyId);
    initCharacter();
    void fetchCharacters();
    setItemDb(drizzleDb, storyId);
    initItem();
    void fetchItems();
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

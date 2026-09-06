import { useEffect, useRef } from 'react';
import { useDrizzle } from '../../../db';
import {
  createChapterService,
  type ChapterService,
} from '../../../services/storymanagement/ChapterService';
import {
  createCharacterSceneService,
  type CharacterSceneServiceInterface,
} from '../../../services/storymanagement/CharacterSceneService';
import {
  createChoiceService,
  type ChoiceService,
} from '../../../services/storymanagement/ChoiceService';
import {
  createEffectService,
  type EffectService,
} from '../../../services/storymanagement/EffectService';
import {
  createItemJourneyService,
  type ItemJourneyService,
} from '../../../services/storymanagement/ItemJourneyService';
import { createItemService, type ItemService } from '../../../services/storymanagement/ItemService';
import {
  createLocationService,
  type LocationService,
} from '../../../services/storymanagement/LocationService';
import { createSceneService } from '../../../services/storymanagement/SceneService';
import { useCharacterStore } from '../../../state/characterStore';

/** Owns service lifecycles and the story-scoped character cache used by Scene detail. */
export function useSceneDetailServices(storyId?: string) {
  const drizzleDb = useDrizzle();
  const sceneServiceRef = useRef<ReturnType<typeof createSceneService> | null>(null);
  const chapterServiceRef = useRef<ChapterService | null>(null);
  const choiceServiceRef = useRef<ChoiceService | null>(null);
  const characterSceneServiceRef = useRef<CharacterSceneServiceInterface | null>(null);
  const locationServiceRef = useRef<LocationService | null>(null);
  const itemServiceRef = useRef<ItemService | null>(null);
  const itemJourneyServiceRef = useRef<ItemJourneyService | null>(null);
  const effectServiceRef = useRef<EffectService | null>(null);
  const { characters, fetchCharacters, setDbAndStoryId, initializeService } = useCharacterStore();

  useEffect(() => {
    if (!drizzleDb) return;
    sceneServiceRef.current ??= createSceneService(drizzleDb);
    chapterServiceRef.current ??= createChapterService(drizzleDb);
    choiceServiceRef.current ??= createChoiceService(drizzleDb);
    characterSceneServiceRef.current ??= createCharacterSceneService(drizzleDb);
    locationServiceRef.current ??= createLocationService(drizzleDb);
    itemServiceRef.current ??= createItemService(drizzleDb);
    itemJourneyServiceRef.current ??= createItemJourneyService(drizzleDb);
    effectServiceRef.current ??= createEffectService(drizzleDb);
  }, [drizzleDb]);

  useEffect(() => {
    if (!drizzleDb || !storyId) return;
    setDbAndStoryId(drizzleDb, storyId);
    initializeService();
    fetchCharacters();
  }, [drizzleDb, storyId, setDbAndStoryId, initializeService, fetchCharacters]);

  return {
    characters,
    sceneServiceRef,
    chapterServiceRef,
    choiceServiceRef,
    characterSceneServiceRef,
    locationServiceRef,
    itemServiceRef,
    itemJourneyServiceRef,
    effectServiceRef,
  };
}

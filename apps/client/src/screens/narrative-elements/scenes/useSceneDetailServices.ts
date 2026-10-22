import { useEffect, useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import { createChapterService } from '@/src/services/storymanagement/scenes-chapters/ChapterService';
import { createCharacterSceneService } from '@/src/services/storymanagement/entities/CharacterSceneService';
import { createChoiceService } from '@/src/services/storymanagement/choices-stats/ChoiceService';
import { createEffectService } from '@/src/services/storymanagement/choices-stats/EffectService';
import { createItemJourneyService } from '@/src/services/storymanagement/entities/ItemJourneyService';
import { createItemService } from '@/src/services/storymanagement/entities/ItemService';
import { createLocationService } from '@/src/services/storymanagement/entities/LocationService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';
import { useCharacterStore } from '@/src/state/story/characterStore';

/** Owns the services Scene detail talks to and the story-scoped character cache it shows. */
export function useSceneDetailServices(storyId?: string) {
  const drizzleDb = useDrizzle();
  const services = useMemo(
    () => ({
      sceneService: createSceneService(drizzleDb),
      chapterService: createChapterService(drizzleDb),
      choiceService: createChoiceService(drizzleDb),
      characterSceneService: createCharacterSceneService(drizzleDb),
      locationService: createLocationService(drizzleDb),
      itemService: createItemService(drizzleDb),
      itemJourneyService: createItemJourneyService(drizzleDb),
      effectService: createEffectService(drizzleDb),
    }),
    [drizzleDb],
  );
  const { characters, fetchCharacters, setDbAndStoryId, initializeService } = useCharacterStore();

  useEffect(() => {
    if (!storyId) return;
    setDbAndStoryId(drizzleDb, storyId);
    initializeService();
    fetchCharacters();
  }, [drizzleDb, storyId, setDbAndStoryId, initializeService, fetchCharacters]);

  return { characters, ...services };
}

export type SceneDetailServices = ReturnType<typeof useSceneDetailServices>;

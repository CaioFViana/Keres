import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import type {
  CharacterSelect,
  ChapterSelect,
  ChoiceSelect,
  ItemJourneySelect,
  SceneSelect,
} from '@/src/db/schema';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { createCharacterService } from '@/src/services/storymanagement/entities/CharacterService';
import { createChapterService } from '@/src/services/storymanagement/scenes-chapters/ChapterService';
import { createChoiceService } from '@/src/services/storymanagement/choices-stats/ChoiceService';
import { createItemJourneyService } from '@/src/services/storymanagement/entities/ItemJourneyService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';

const NOTHING_LOADED: {
  journeys: ItemJourneySelect[];
  scenes: SceneSelect[];
  chapters: ChapterSelect[];
  choices: ChoiceSelect[];
  characters: CharacterSelect[];
} = { journeys: [], scenes: [], chapters: [], choices: [], characters: [] };
const JOURNEY_EVENTS = ['item_journey_changed'] as const;

export function useItemJourneyTimelineData(storyId: string, itemId: string) {
  const drizzleDb = useDrizzle();
  const load = useMemo(
    () =>
      storyId
        ? async () => {
            const [journeys, scenes, chapters, choices, characters] = await Promise.all([
              createItemJourneyService(drizzleDb).getItemJourneysByItemId(storyId, itemId),
              createSceneService(drizzleDb).getAllByStoryId(storyId),
              createChapterService(drizzleDb).getAllByStoryId(storyId),
              createChoiceService(drizzleDb).getAllByStoryId(storyId),
              createCharacterService(drizzleDb).getAllByStoryId(storyId),
            ]);
            return { journeys, scenes, chapters, choices, characters };
          }
        : null,
    [drizzleDb, itemId, storyId],
  );
  const { data, loading } = useLoadedResource({
    load,
    initial: NOTHING_LOADED,
    events: JOURNEY_EVENTS,
    storyId,
    label: 'item journey timeline',
  });

  return { ...data, loading };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type {
  CharacterSelect,
  ChapterSelect,
  ChoiceSelect,
  ItemJourneySelect,
  SceneSelect,
} from '@/src/db/schema';
import { createCharacterService } from '@/src/services/storymanagement/CharacterService';
import { createChapterService } from '@/src/services/storymanagement/ChapterService';
import { createChoiceService } from '@/src/services/storymanagement/ChoiceService';
import { createItemJourneyService } from '@/src/services/storymanagement/ItemJourneyService';
import { createSceneService } from '@/src/services/storymanagement/SceneService';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';

export function useItemJourneyTimelineData(storyId: string, itemId: string) {
  const drizzleDb = useDrizzle();
  const [journeys, setJourneys] = useState<ItemJourneySelect[]>([]);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
  const [choices, setChoices] = useState<ChoiceSelect[]>([]);
  const [characters, setCharacters] = useState<CharacterSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!drizzleDb || !storyId) return;
    if (!loadedRef.current) setLoading(true);
    try {
      const [fetchedJourneys, fetchedScenes, fetchedChapters, fetchedChoices, fetchedCharacters] =
        await Promise.all([
          createItemJourneyService(drizzleDb).getItemJourneysByItemId(storyId, itemId),
          createSceneService(drizzleDb).getAllByStoryId(storyId),
          createChapterService(drizzleDb).getAllByStoryId(storyId),
          createChoiceService(drizzleDb).getAllByStoryId(storyId),
          createCharacterService(drizzleDb).getAllByStoryId(storyId),
        ]);
      setJourneys(fetchedJourneys);
      setScenes(fetchedScenes);
      setChapters(fetchedChapters);
      setChoices(fetchedChoices);
      setCharacters(fetchedCharacters);
    } catch (err) {
      console.error('Failed to load item journey timeline:', err);
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, [drizzleDb, itemId, storyId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `load` sets loading synchronously for its event callers and everything else after `await`; the rule cannot verify across the callback boundary.
    void load();
  }, [load]);

  useEffect(() => {
    const handleChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) void load();
    };
    entityEventEmitter.on('item_journey_changed', handleChange);
    return () => {
      entityEventEmitter.off('item_journey_changed', handleChange);
    };
  }, [load, storyId]);

  return { journeys, scenes, chapters, choices, characters, loading };
}

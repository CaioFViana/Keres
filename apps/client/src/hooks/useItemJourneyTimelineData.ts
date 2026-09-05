import { useCallback, useEffect, useRef, useState } from 'react';
import { useDrizzle } from '../db';
import type {
  CharacterSelect,
  ChapterSelect,
  ChoiceSelect,
  ItemJourneySelect,
  SceneSelect,
} from '../db/schema';
import { createCharacterService } from '../services/storymanagement/CharacterService';
import { createChapterService } from '../services/storymanagement/ChapterService';
import { createChoiceService } from '../services/storymanagement/ChoiceService';
import { createItemJourneyService } from '../services/storymanagement/ItemJourneyService';
import { createSceneService } from '../services/storymanagement/SceneService';
import { entityEventEmitter } from '../utils/EventEmitter';

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

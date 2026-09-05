import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '../db';
import type {
  CharacterSelect,
  ChapterSelect,
  ItemJourneySelect,
  ItemSelect,
  SceneSelect,
} from '../db/schema';
import { createCharacterSceneService } from '../services/storymanagement/CharacterSceneService';
import { createCharacterService } from '../services/storymanagement/CharacterService';
import { createChapterService } from '../services/storymanagement/ChapterService';
import { createItemJourneyService } from '../services/storymanagement/ItemJourneyService';
import { createItemService } from '../services/storymanagement/ItemService';
import { createSceneService } from '../services/storymanagement/SceneService';

export function usePresenceMatrixCatalog(
  storyId: string | undefined,
  itemIds: string[],
  loadItemJourneys: boolean,
) {
  const db = useDrizzle();
  const [characters, setCharacters] = useState<CharacterSelect[]>([]);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
  const [presence, setPresence] = useState<{ characterId: string; sceneId: string }[]>([]);
  const [items, setItems] = useState<ItemSelect[]>([]);
  const [journeys, setJourneys] = useState<ItemJourneySelect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storyId) return;
    (async () => {
      setLoading(true);
      try {
        const [cs, ss, hs, ps, loadedItems] = await Promise.all([
          createCharacterService(db).getAllByStoryId(storyId),
          createSceneService(db).getAllByStoryId(storyId),
          createChapterService(db).getAllByStoryId(storyId, null),
          createCharacterSceneService(db).getRelationsByStoryId(storyId),
          createItemService(db).getAllByStoryId(storyId),
        ]);
        setCharacters(cs.filter((entry) => !entry.isDeleted));
        setScenes(ss.filter((entry) => !entry.isDeleted));
        setChapters(hs.filter((entry) => !entry.isDeleted));
        setPresence(ps.filter((entry) => !entry.isDeleted));
        setItems(loadedItems.filter((entry) => !entry.isDeleted));
      } finally {
        setLoading(false);
      }
    })();
  }, [db, storyId]);

  useEffect(() => {
    if (!storyId || !loadItemJourneys) {
      setJourneys([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const journeysByItem = await Promise.all(
        itemIds.map((itemId) => createItemJourneyService(db).getItemJourneysByItemId(storyId, itemId)),
      );
      if (!cancelled) setJourneys(journeysByItem.flat().filter((entry) => !entry.isDeleted));
    })();
    return () => {
      cancelled = true;
    };
  }, [db, itemIds, loadItemJourneys, storyId]);

  const fetchAllItemJourneys = useCallback(async () => {
    if (!storyId) return [] as ItemJourneySelect[];
    const journeysByItem = await Promise.all(
      items.map((entry) => createItemJourneyService(db).getItemJourneysByItemId(storyId, entry.id)),
    );
    const allJourneys = journeysByItem.flat().filter((entry) => !entry.isDeleted);
    setJourneys(allJourneys);
    return allJourneys;
  }, [db, items, storyId]);

  return {
    characters,
    scenes,
    chapters,
    presence,
    items,
    journeys,
    loading,
    fetchAllItemJourneys,
  };
}

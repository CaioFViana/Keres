import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type {
  CharacterSelect,
  ChapterSelect,
  ItemJourneySelect,
  ItemSelect,
  SceneSelect,
} from '@/src/db/schema';
import { createCharacterSceneService } from '@/src/services/storymanagement/entities/CharacterSceneService';
import { createCharacterService } from '@/src/services/storymanagement/entities/CharacterService';
import { createChapterService } from '@/src/services/storymanagement/scenes-chapters/ChapterService';
import { createItemJourneyService } from '@/src/services/storymanagement/entities/ItemJourneyService';
import { createItemService } from '@/src/services/storymanagement/entities/ItemService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';
import { fireAndLog } from '@/src/utils/logging/fireAndLog';

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
    fireAndLog(
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
      })(),
      'usePresenceMatrixCatalog',
    );
  }, [db, storyId]);

  const [prevStoryId, setPrevStoryId] = useState(storyId);
  const [prevLoadItemJourneys, setPrevLoadItemJourneys] = useState(loadItemJourneys);
  if (storyId !== prevStoryId || loadItemJourneys !== prevLoadItemJourneys) {
    setPrevStoryId(storyId);
    setPrevLoadItemJourneys(loadItemJourneys);
    if (!storyId || !loadItemJourneys) {
      setJourneys([]);
    }
  }

  useEffect(() => {
    if (!storyId || !loadItemJourneys) {
      return;
    }
    let cancelled = false;
    fireAndLog(
      (async () => {
        const journeysByItem = await Promise.all(
          itemIds.map((itemId) =>
            createItemJourneyService(db).getItemJourneysByItemId(storyId, itemId),
          ),
        );
        if (!cancelled) setJourneys(journeysByItem.flat().filter((entry) => !entry.isDeleted));
      })(),
      'usePresenceMatrixCatalog',
    );
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

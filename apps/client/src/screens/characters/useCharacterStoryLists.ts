import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import { useStoryEntities } from '@/src/hooks/lists/useStoryEntities';
import { createItemJourneyService } from '@/src/services/storymanagement/entities/ItemJourneyService';
import { createItemService } from '@/src/services/storymanagement/entities/ItemService';
import { createLocationService } from '@/src/services/storymanagement/entities/LocationService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';
import type { CharacterDetailServices } from './useCharacterDetailServices';

const CHARACTER_EVENTS = ['character_changed'] as const;
const CHARACTER_RELATION_EVENTS = ['character_relation_changed'] as const;
const CHARACTER_SCENE_EVENTS = ['character_scene_changed'] as const;
const SCENE_EVENTS = ['scene_changed'] as const;
const ITEM_EVENTS = ['item_changed'] as const;
const ITEM_JOURNEY_EVENTS = ['item_journey_changed'] as const;
const LOCATION_EVENTS = ['location_changed'] as const;

/**
 * Everything the character detail shows from the rest of the story, plus the character's own
 * relations and scenes. The story's lists reload on any change in the story; the character's own
 * reload when an event names this character.
 */
export function useCharacterStoryLists(
  { characterService, relationService, characterSceneService }: CharacterDetailServices,
  storyId: string | undefined,
  characterId: string,
) {
  const drizzleDb = useDrizzle();
  const storyLoaders = useMemo(() => {
    const scenes = createSceneService(drizzleDb);
    const items = createItemService(drizzleDb);
    const itemJourneys = createItemJourneyService(drizzleDb);
    const locations = createLocationService(drizzleDb);
    return {
      scenes: (id: string) => scenes.getScenesByStoryId(id),
      items: (id: string) => items.getAllByStoryId(id),
      itemJourneys: (id: string) => itemJourneys.getAllByStoryId(id),
      locations: (id: string) => locations.getAllByStoryId(id),
    };
  }, [drizzleDb]);
  const loadCharacters = useMemo(
    () => (id: string) => characterService.getAllByStoryId(id),
    [characterService],
  );
  const loadRelations = useMemo(
    () => (id: string) => relationService.getRelationsForCharacter(id, characterId),
    [relationService, characterId],
  );
  const loadCharacterScenes = useMemo(
    () => (id: string) => characterSceneService.getRelationsForCharacter(id, characterId),
    [characterSceneService, characterId],
  );

  const characters = useStoryEntities({
    storyId,
    load: loadCharacters,
    events: CHARACTER_EVENTS,
    label: 'all characters',
  });
  const relations = useStoryEntities({
    storyId,
    entityId: characterId,
    load: loadRelations,
    events: CHARACTER_RELATION_EVENTS,
    label: 'character relations',
  });
  const characterScenes = useStoryEntities({
    storyId,
    entityId: characterId,
    load: loadCharacterScenes,
    events: CHARACTER_SCENE_EVENTS,
    label: 'character scene relations',
  });
  const scenes = useStoryEntities({
    storyId,
    load: storyLoaders.scenes,
    events: SCENE_EVENTS,
    label: 'all scenes',
  });
  const items = useStoryEntities({
    storyId,
    load: storyLoaders.items,
    events: ITEM_EVENTS,
    label: 'all items',
  });
  const itemJourneys = useStoryEntities({
    storyId,
    load: storyLoaders.itemJourneys,
    events: ITEM_JOURNEY_EVENTS,
    label: 'all item journeys',
  });
  const locations = useStoryEntities({
    storyId,
    load: storyLoaders.locations,
    events: LOCATION_EVENTS,
    label: 'all locations',
  });

  return { characters, relations, characterScenes, scenes, items, itemJourneys, locations };
}

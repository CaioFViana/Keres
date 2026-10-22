import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import { useStoryEntities } from '@/src/hooks/lists/useStoryEntities';
import { createCharacterSceneService } from '@/src/services/storymanagement/entities/CharacterSceneService';
import { createCharacterService } from '@/src/services/storymanagement/entities/CharacterService';
import { createItemJourneyService } from '@/src/services/storymanagement/entities/ItemJourneyService';
import { createItemService } from '@/src/services/storymanagement/entities/ItemService';
import { createLocationService } from '@/src/services/storymanagement/entities/LocationService';
import { createLocationRelationService } from '@/src/services/storymanagement/relations/LocationRelationService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';

const CHARACTER_EVENTS = ['character_changed'] as const;
const SCENE_EVENTS = ['scene_changed'] as const;
const CHARACTER_SCENE_EVENTS = ['character_scene_changed'] as const;
const ITEM_EVENTS = ['item_changed'] as const;
const ITEM_JOURNEY_EVENTS = ['item_journey_changed'] as const;
const LOCATION_EVENTS = ['location_changed'] as const;
const LOCATION_RELATION_EVENTS = ['location_relation_changed'] as const;

/**
 * Everything the location detail shows from the rest of the story: who and what is in it, and how
 * the places connect. Each list reloads on its own events, and the services already leave deleted
 * rows out.
 */
export function useLocationStoryLists(storyId: string | undefined, enabled: boolean) {
  const drizzleDb = useDrizzle();
  const loaders = useMemo(() => {
    const characters = createCharacterService(drizzleDb);
    const scenes = createSceneService(drizzleDb);
    const characterScenes = createCharacterSceneService(drizzleDb);
    const items = createItemService(drizzleDb);
    const itemJourneys = createItemJourneyService(drizzleDb);
    const locations = createLocationService(drizzleDb);
    const locationRelations = createLocationRelationService(drizzleDb);
    return {
      characters: (id: string) => characters.getAllByStoryId(id),
      scenes: (id: string) => scenes.getScenesByStoryId(id),
      characterScenes: (id: string) => characterScenes.getRelationsByStoryId(id),
      items: (id: string) => items.getAllByStoryId(id),
      itemJourneys: (id: string) => itemJourneys.getAllByStoryId(id),
      locations: (id: string) => locations.getAllByStoryId(id),
      locationRelations: (id: string) => locationRelations.getAllRelationsForStory(id),
    };
  }, [drizzleDb]);

  const characters = useStoryEntities({
    storyId,
    enabled,
    load: loaders.characters,
    events: CHARACTER_EVENTS,
    label: 'all characters',
  });
  const scenes = useStoryEntities({
    storyId,
    enabled,
    load: loaders.scenes,
    events: SCENE_EVENTS,
    label: 'all scenes',
  });
  const characterScenes = useStoryEntities({
    storyId,
    enabled,
    load: loaders.characterScenes,
    events: CHARACTER_SCENE_EVENTS,
    label: 'all character scene relations',
  });
  const items = useStoryEntities({
    storyId,
    enabled,
    load: loaders.items,
    events: ITEM_EVENTS,
    label: 'all items',
  });
  const itemJourneys = useStoryEntities({
    storyId,
    enabled,
    load: loaders.itemJourneys,
    events: ITEM_JOURNEY_EVENTS,
    label: 'all item journeys',
  });
  const locations = useStoryEntities({
    storyId,
    enabled,
    load: loaders.locations,
    events: LOCATION_EVENTS,
    label: 'all locations',
  });
  const locationRelations = useStoryEntities({
    storyId,
    enabled,
    load: loaders.locationRelations,
    events: LOCATION_RELATION_EVENTS,
    label: 'all location relations',
  });

  return { characters, scenes, characterScenes, items, itemJourneys, locations, locationRelations };
}

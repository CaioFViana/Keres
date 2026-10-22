import { useMemo } from 'react';
import { useStoryEntities } from '@/src/hooks/lists/useStoryEntities';
import type { SceneDetailServices } from './useSceneDetailServices';

const CHAPTER_EVENTS = ['chapter_changed'] as const;
const LOCATION_EVENTS = ['location_changed'] as const;
const SCENE_EVENTS = ['scene_changed'] as const;
const CHOICE_EVENTS = ['choice_changed'] as const;
const CHARACTER_SCENE_EVENTS = ['character_scene_changed'] as const;
const ITEM_EVENTS = ['item_changed'] as const;
const ITEM_JOURNEY_EVENTS = ['item_journey_changed'] as const;
const EFFECT_EVENTS = ['effect_changed'] as const;

interface SceneDetailListsParams {
  /** The story whose rows are read. */
  storyId: string | undefined;
  sceneId: string;
  chapterId: string | null | undefined;
  locationId: string | null | undefined;
  /** False until the scene itself is on screen. */
  enabled: boolean;
  isLinear: boolean;
  isBranching: boolean;
}

/**
 * Everything the scene detail shows around the scene: the chapter and place it belongs to, its
 * neighbours (linear stories) or the choices that leave and reach it (branching ones), who is in it,
 * its items and journeys, and its effects. Each reloads on the events that concern it.
 */
export function useSceneDetailLists(
  {
    chapterService,
    locationService,
    sceneService,
    choiceService,
    characterSceneService,
    itemService,
    itemJourneyService,
    effectService,
  }: SceneDetailServices,
  {
    storyId,
    sceneId,
    chapterId,
    locationId,
    enabled,
    isLinear,
    isBranching,
  }: SceneDetailListsParams,
) {
  // A single record is read as a list of at most one, so it shares the guard and the events.
  const loadChapter = useMemo(
    () => async () => {
      const chapter = chapterId ? await chapterService.getById(chapterId) : undefined;
      return chapter ? [chapter] : [];
    },
    [chapterService, chapterId],
  );
  const loadLocation = useMemo(
    () => async () => {
      const location = locationId ? await locationService.getById(locationId) : undefined;
      return location ? [location] : [];
    },
    [locationService, locationId],
  );
  const loadNeighbours = useMemo(
    () => async (id: string) =>
      chapterId ? [await sceneService.getPreviousNextScenes(id, sceneId, chapterId)] : [],
    [sceneService, sceneId, chapterId],
  );
  // `sceneId` is the criterion the service understands for the choices that *leave* this scene.
  const loadChoices = useMemo(
    () => (id: string) =>
      choiceService.getChoicesByStoryId(id, undefined, undefined, undefined, { sceneId }),
    [choiceService, sceneId],
  );
  const loadIncomingChoices = useMemo(
    () => (id: string) =>
      choiceService.getChoicesByStoryId(id, undefined, undefined, undefined, {
        nextSceneId: sceneId,
      }),
    [choiceService, sceneId],
  );
  const loadCharacterScenes = useMemo(
    () => (id: string) => characterSceneService.getRelationsForScene(id, sceneId),
    [characterSceneService, sceneId],
  );
  const loadItemJourneys = useMemo(
    () => (id: string) => itemJourneyService.getItemJourneysBySceneId(id, sceneId),
    [itemJourneyService, sceneId],
  );
  const loadEffects = useMemo(
    () => (id: string) => effectService.getEffectsByEntity(id, 'Scene', sceneId),
    [effectService, sceneId],
  );

  const [chapter] = useStoryEntities({
    storyId,
    enabled: enabled && !!chapterId,
    load: loadChapter,
    events: CHAPTER_EVENTS,
    label: 'chapter details',
  });
  const [location] = useStoryEntities({
    storyId,
    enabled: enabled && !!locationId,
    load: loadLocation,
    events: LOCATION_EVENTS,
    label: 'location details',
  });
  const [neighbours] = useStoryEntities({
    storyId,
    enabled: enabled && isLinear && !!chapterId,
    load: loadNeighbours,
    events: SCENE_EVENTS,
    label: 'previous and next scenes',
  });
  const choicesForScene = useStoryEntities({
    storyId,
    enabled: enabled && isBranching,
    load: loadChoices,
    events: CHOICE_EVENTS,
    label: 'choices for scene',
  });
  const incomingChoicesForScene = useStoryEntities({
    storyId,
    enabled: enabled && isBranching,
    load: loadIncomingChoices,
    events: CHOICE_EVENTS,
    label: 'incoming choices for scene',
  });
  const scenes = useStoryEntities({
    storyId,
    enabled: enabled && isBranching,
    load: sceneService.getAllByStoryId,
    events: SCENE_EVENTS,
    label: 'scene name lookups',
  });
  const characterSceneRelations = useStoryEntities({
    storyId,
    entityId: sceneId,
    enabled,
    load: loadCharacterScenes,
    events: CHARACTER_SCENE_EVENTS,
    label: 'character-scene relations',
  });
  const allItems = useStoryEntities({
    storyId,
    enabled,
    load: itemService.getItemsByStoryId,
    events: ITEM_EVENTS,
    label: 'all items',
  });
  const itemJourneys = useStoryEntities({
    storyId,
    enabled,
    load: loadItemJourneys,
    events: ITEM_JOURNEY_EVENTS,
    label: 'item journeys for scene',
  });
  const sceneEffects = useStoryEntities({
    storyId,
    entityId: sceneId,
    enabled: enabled && isBranching,
    load: loadEffects,
    events: EFFECT_EVENTS,
    label: 'scene effects',
  });

  const sceneNamesById = useMemo(
    () => Object.fromEntries(scenes.map((scene) => [scene.id, scene.name])),
    [scenes],
  );

  return {
    chapter: chapter ?? null,
    location: location ?? null,
    previousScene: neighbours?.previousScene,
    nextScene: neighbours?.nextScene,
    choicesForScene,
    incomingChoicesForScene,
    sceneNamesById,
    characterSceneRelations,
    allItems,
    itemJourneys,
    sceneEffects,
  };
}

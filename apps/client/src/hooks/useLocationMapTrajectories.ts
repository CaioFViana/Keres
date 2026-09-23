import type { CanvasOverlayType, LocationMapContentType } from '@keres/shared';
import { buildTrajectoryStops, projectTrajectoryStops } from '@keres/shared/graphs/trajectories';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type {
  ChapterSelect,
  CharacterSceneSelect,
  CharacterSelect,
  ItemJourneySelect,
  ItemSelect,
  RouteSelect,
  RouteStepSelect,
  SceneSelect,
} from '../db/schema';
import { createChapterService } from '../services/storymanagement/ChapterService';
import { createCharacterSceneService } from '../services/storymanagement/CharacterSceneService';
import { createCharacterService } from '../services/storymanagement/CharacterService';
import { createItemJourneyService } from '../services/storymanagement/ItemJourneyService';
import { createItemService } from '../services/storymanagement/ItemService';
import { createRouteService } from '../services/storymanagement/RouteService';
import { createSceneService } from '../services/storymanagement/SceneService';

interface UseLocationMapTrajectoriesOptions {
  storyId: string | undefined;
  storyType: 'linear' | 'branching' | undefined;
  nodes: LocationMapContentType['nodes'];
}

/**
 * Ephemeral trajectory layers for one location map: the story catalog (scenes, chapters,
 * appearances, items, journeys, routes), the picked characters/items/route, and the
 * transient line overlays projected onto this map's points. Nothing persists: closing the
 * map forgets the selection, and the lines never enter the map content.
 */
export function useLocationMapTrajectories({
  storyId,
  storyType,
  nodes,
}: UseLocationMapTrajectoriesOptions) {
  const db = useDrizzle();
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
  const [appearances, setAppearances] = useState<CharacterSceneSelect[]>([]);
  const [items, setItems] = useState<ItemSelect[]>([]);
  const [journeys, setJourneys] = useState<ItemJourneySelect[]>([]);
  const [characters, setCharacters] = useState<CharacterSelect[]>([]);
  const [routes, setRoutes] = useState<RouteSelect[]>([]);
  const [stepsByRoute, setStepsByRoute] = useState<Record<string, RouteStepSelect[]>>({});
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!storyId) return;
      const routeService = createRouteService(db);
      const [
        loadedScenes,
        loadedChapters,
        loadedAppearances,
        loadedItems,
        loadedJourneys,
        loadedCharacters,
        loadedRoutes,
      ] = await Promise.all([
        createSceneService(db).getAllByStoryId(storyId),
        createChapterService(db).getAllByStoryId(storyId),
        createCharacterSceneService(db).getRelationsByStoryId(storyId),
        createItemService(db).getAllByStoryId(storyId),
        createItemJourneyService(db).getAllByStoryId(storyId),
        createCharacterService(db).getAllByStoryId(storyId),
        storyType === 'branching' ? routeService.getAllByStoryId(storyId) : Promise.resolve([]),
      ]);
      const loadedSteps: Record<string, RouteStepSelect[]> = {};
      for (const route of loadedRoutes) {
        if (route.isDeleted) continue;
        loadedSteps[route.id] = (await routeService.getSteps(route.id)).filter(
          (step) => !step.isDeleted,
        );
      }
      if (cancelled) return;
      setScenes(loadedScenes.filter((scene) => !scene.isDeleted));
      setChapters(loadedChapters.filter((chapter) => !chapter.isDeleted));
      setAppearances(loadedAppearances.filter((appearance) => !appearance.isDeleted));
      setItems(loadedItems.filter((item) => !item.isDeleted));
      setJourneys(loadedJourneys.filter((journey) => !journey.isDeleted));
      setCharacters(loadedCharacters.filter((character) => !character.isDeleted));
      setRoutes(loadedRoutes.filter((route) => !route.isDeleted));
      setStepsByRoute(loadedSteps);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, storyId, storyType]);

  const toggleCharacter = useCallback((id: string) => {
    setSelectedCharacterIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id],
    );
  }, []);
  const toggleItem = useCallback((id: string) => {
    setSelectedItemIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id],
    );
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedCharacterIds([]);
    setSelectedItemIds([]);
  }, []);

  const routeId = selectedRouteId ?? routes[0]?.id ?? null;
  const points = useMemo(
    () => nodes.map((node) => ({ locationId: node.locationId, x: node.x, y: node.y })),
    [nodes],
  );
  const { overlays, offMapCount } = useMemo(() => {
    if (!storyType) return { overlays: [], offMapCount: 0 };
    const steps = routeId ? (stepsByRoute[routeId] ?? []) : [];
    const built: CanvasOverlayType[] = [];
    let offMap = 0;
    for (const characterId of selectedCharacterIds) {
      const character = characters.find((candidate) => candidate.id === characterId);
      if (!character) continue;
      const stops = buildTrajectoryStops({
        scenes,
        chapters,
        relevantSceneIds: new Set(
          appearances
            .filter((appearance) => appearance.characterId === characterId)
            .map((appearance) => appearance.sceneId),
        ),
        storyType,
        steps,
      });
      const projected = projectTrajectoryStops(stops, points);
      offMap += projected.offMap;
      if (projected.points.length >= 2) {
        built.push({
          id: `traj:c:${characterId}`,
          kind: 'line',
          points: projected.points,
          label: character.name,
          dashed: true,
          directed: true,
        });
      }
    }
    for (const itemId of selectedItemIds) {
      const item = items.find((candidate) => candidate.id === itemId);
      if (!item) continue;
      const stops = buildTrajectoryStops({
        scenes,
        chapters,
        relevantSceneIds: new Set(
          journeys.filter((journey) => journey.itemId === itemId).map((journey) => journey.sceneId),
        ),
        storyType,
        steps,
      });
      const projected = projectTrajectoryStops(stops, points);
      offMap += projected.offMap;
      if (projected.points.length >= 2) {
        built.push({
          id: `traj:i:${itemId}`,
          kind: 'line',
          points: projected.points,
          label: item.name,
          dashed: true,
          directed: true,
        });
      }
    }
    return { overlays: built, offMapCount: offMap };
  }, [
    appearances,
    chapters,
    characters,
    items,
    journeys,
    points,
    routeId,
    scenes,
    selectedCharacterIds,
    selectedItemIds,
    stepsByRoute,
    storyType,
  ]);

  return {
    characters,
    items,
    routes,
    routeId,
    selectedCharacterIds,
    selectedItemIds,
    pickerOpen,
    setPickerOpen,
    toggleCharacter,
    toggleItem,
    selectRoute: setSelectedRouteId,
    clearSelection,
    overlays,
    offMapCount,
    hasSelection: selectedCharacterIds.length + selectedItemIds.length > 0,
  };
}

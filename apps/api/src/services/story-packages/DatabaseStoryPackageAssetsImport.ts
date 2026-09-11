import { OperationLogEntityType, remapBoardContent, remapLocationMapContent } from '@keres/shared';
import type { DatabaseStoryPackageImportContext } from './DatabaseStoryPackageImportContext';
import { insertPortableCollection } from './DatabaseStoryPackageCollectionRepository';

/**
 * Prepares visual and navigational assets: plots, routes, galleries, items, boards, and maps.
 * It remaps IDs and embedded JSON references before delegating persistence to the collection repository.
 */
export async function importStoryAssets(context: DatabaseStoryPackageImportContext): Promise<void> {
  const { fullStory: validatedFullStory, idMap, nextId, now, targetStoryId } = context;
  // --- Plots ---
  const newPlotsData = (validatedFullStory.plots ?? []).map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  await insertPortableCollection(context, OperationLogEntityType.Plot, newPlotsData);

  // --- PlotScenes ---
  const newPlotScenesData = (validatedFullStory.plotScenes ?? []).map((original) => {
    const newId = nextId(original.id);
    const plotId = idMap.get(original.plotId);
    const sceneId = idMap.get(original.sceneId);
    if (!plotId || !sceneId)
      throw new Error(`Import Error: plot or scene missing for plot-scene ${original.id}.`);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      plotId,
      sceneId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  await insertPortableCollection(context, OperationLogEntityType.PlotScene, newPlotScenesData);

  // --- Routes ---
  const newRoutesData = (validatedFullStory.routes ?? []).map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  await insertPortableCollection(context, OperationLogEntityType.Route, newRoutesData);

  // --- RouteSteps ---
  const newRouteStepsData = (validatedFullStory.routeSteps ?? []).map((original) => {
    const newId = nextId(original.id);
    const routeId = idMap.get(original.routeId);
    const sceneId = idMap.get(original.sceneId);
    const selectedChoiceId = original.selectedChoiceId
      ? idMap.get(original.selectedChoiceId)
      : null;
    if (!routeId || !sceneId || (original.selectedChoiceId && !selectedChoiceId)) {
      throw new Error(
        `Import Error: route, scene, or choice missing for route step ${original.id}.`,
      );
    }
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      routeId,
      sceneId,
      selectedChoiceId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  await insertPortableCollection(context, OperationLogEntityType.RouteStep, newRouteStepsData);

  // --- GalleryItems ---
  const newGalleryItemsData = validatedFullStory.galleryItems.map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  if (newGalleryItemsData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.Gallery, newGalleryItemsData);
  }

  // --- Items (Optional) ---
  if (validatedFullStory.items && validatedFullStory.items.length > 0) {
    const newItemsData = validatedFullStory.items.map((original) => {
      const newId = nextId(original.id);
      idMap.set(original.id, newId);
      return {
        ...original,
        id: newId,
        storyId: targetStoryId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(context, OperationLogEntityType.Item, newItemsData);
  }

  /*
   * Boards after every pinnable entity is in the id map (characters, locations, notes,
   * scenes, items, galleries, chapters). Ghost pins — ids that never appear — stay unmapped.
   */
  const newStoryBoardsData = (validatedFullStory.storyBoards ?? []).map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      content: remapBoardContent(original.content, (id) => idMap.get(id) ?? id),
      createdAt: new Date(original.createdAt),
      updatedAt: new Date(original.updatedAt),
      deletedAt: original.deletedAt ? new Date(original.deletedAt) : null,
    };
  });
  if (newStoryBoardsData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.Board, newStoryBoardsData);
  }

  /*
   * Location maps hold location and gallery ids in their JSON document. They therefore wait
   * until both collections are in the id map, just as boards wait for their pinnable entities.
   */
  const newStoryLocationMapsData = (validatedFullStory.storyLocationMaps ?? []).map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      content: remapLocationMapContent(original.content, (id) => idMap.get(id) ?? id),
      createdAt: new Date(original.createdAt),
      updatedAt: new Date(original.updatedAt),
      deletedAt: original.deletedAt ? new Date(original.deletedAt) : null,
    };
  });
  if (newStoryLocationMapsData.length > 0) {
    await insertPortableCollection(
      context,
      OperationLogEntityType.LocationMap,
      newStoryLocationMapsData,
    );
  }
}

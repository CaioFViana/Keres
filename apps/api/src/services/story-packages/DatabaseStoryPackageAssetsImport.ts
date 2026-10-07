import {
  OperationLogEntityType,
  remapBoardContent,
  remapLocationMapContent,
  remapSketchContent,
  remapSketchCoverGalleryId,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import { stories, storyArcs } from '../../db/schema';
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

  /*
   * Sketches hold a gallery id only as a row-level cover link, remapped here after the
   * gallery collection is in the id map. A snapshot the package does not carry clears
   * the cover instead of pointing at a stranger's row.
   */
  const newStorySketchesData = (validatedFullStory.storySketches ?? []).map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      content: remapSketchContent(original.content),
      coverGalleryId: remapSketchCoverGalleryId(original.coverGalleryId, (id) => idMap.get(id)),
      createdAt: new Date(original.createdAt),
      updatedAt: new Date(original.updatedAt),
      deletedAt: original.deletedAt ? new Date(original.deletedAt) : null,
    };
  });
  if (newStorySketchesData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.Sketch, newStorySketchesData);
  }

  /*
   * The pages of a scene point at a scene (narrative phase), and at a Sketch or a Gallery medium
   * (both written just above): every id is in the map by now. A page whose image the package does
   * not carry keeps its text and waits for another image, as it does live.
   */
  const newScenePagesData = (validatedFullStory.scenePages ?? []).flatMap((original) => {
    const sceneId = idMap.get(original.sceneId);
    // A page of a scene the package lacks has nothing to belong to: it goes, as dangling rows do.
    if (!sceneId) return [];
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return [
      {
        ...original,
        id: newId,
        storyId: targetStoryId,
        sceneId,
        sketchId: original.sketchId ? (idMap.get(original.sketchId) ?? null) : null,
        galleryId: original.galleryId ? (idMap.get(original.galleryId) ?? null) : null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      },
    ];
  });
  if (newScenePagesData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.ScenePage, newScenePagesData);
  }

  /*
   * The music of a scene points at a scene (narrative phase), and at a Song or a Gallery medium (both
   * written before this): every id is in the map by now. A link whose target the package does not
   * carry keeps its cue and waits for another target, as it does live.
   */
  const newSceneMusicData = (validatedFullStory.sceneMusic ?? []).flatMap((original) => {
    const sceneId = idMap.get(original.sceneId);
    // Music of a scene the package lacks has nothing to belong to: it goes, as dangling rows do.
    if (!sceneId) return [];
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return [
      {
        ...original,
        id: newId,
        storyId: targetStoryId,
        sceneId,
        songId: original.songId ? (idMap.get(original.songId) ?? null) : null,
        galleryId: original.galleryId ? (idMap.get(original.galleryId) ?? null) : null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      },
    ];
  });
  if (newSceneMusicData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.SceneMusic, newSceneMusicData);
  }

  await relinkCoverGalleryIds(context);
}

/*
 * The story and its arcs are written in the core phase, before any gallery row has a new id, so
 * they are inserted without a cover and linked here. A cover the package does not carry stays
 * empty rather than pointing at a stranger's row.
 */
async function relinkCoverGalleryIds(context: DatabaseStoryPackageImportContext): Promise<void> {
  const { fullStory, idMap, targetStoryId, tx } = context;
  const storyCover = fullStory.story.coverGalleryId
    ? idMap.get(fullStory.story.coverGalleryId)
    : undefined;
  if (storyCover) {
    await tx
      .update(stories)
      .set({ coverGalleryId: storyCover })
      .where(eq(stories.id, targetStoryId));
  }
  for (const arc of fullStory.storyArcs ?? []) {
    const arcId = idMap.get(arc.id);
    const cover = arc.coverGalleryId ? idMap.get(arc.coverGalleryId) : undefined;
    if (arcId && cover) {
      await tx.update(storyArcs).set({ coverGalleryId: cover }).where(eq(storyArcs.id, arcId));
    }
  }
}

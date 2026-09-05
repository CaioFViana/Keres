import { OperationLogEntityType } from '@keres/shared';
import type { DatabaseStoryPackageImportContext } from './DatabaseStoryPackageImportContext';
import {
  insertPortableCollection,
  insertStoryRoot,
} from './DatabaseStoryPackageCollectionRepository';
import { normalizeImportedLinearSceneFlags } from './DatabaseStoryPackageSceneWriter';

/**
 * Prepares the foundational graph — story, arcs, chapters, locations, scenes, and choices — in
 * parent-before-child order. It owns ID remapping and relationship validation, not SQL writes.
 */
export async function importStoryCore(context: DatabaseStoryPackageImportContext): Promise<void> {
  const { fullStory: validatedFullStory, idMap, nextId, now, targetStoryId, userId } = context;
  // --- Story ---
  const newStoryData = {
    ...validatedFullStory.story,
    id: targetStoryId,
    userId: userId, // Ensure story is owned by the importing user
    version: 1,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
    deletedAt: null,
  };
  await insertStoryRoot(context, newStoryData);

  const newStoryArcsData = (validatedFullStory.storyArcs ?? []).map((original) => {
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
      deletedAt: original.deletedAt ? new Date(original.deletedAt) : null,
    };
  });
  if (newStoryArcsData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.StoryArc, newStoryArcsData);
  }

  // --- Chapters ---
  const newChaptersData = validatedFullStory.chapters.map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      arcId: original.arcId ? (idMap.get(original.arcId) ?? original.arcId) : null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  if (newChaptersData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.Chapter, newChaptersData);
  }

  // --- Locations ---
  // Before Scenes on purpose: every Scene has a mandatory locationId, which has to already be in the
  // idMap by the time the Scenes block runs just below.
  const newLocationsData = validatedFullStory.locations.map((original) => {
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
  if (newLocationsData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.Location, newLocationsData);
  }

  // --- LocationRelations (Optional) ---
  // After Locations on purpose: locationAId/locationBId have to already be in the idMap.
  if (validatedFullStory.locationRelations && validatedFullStory.locationRelations.length > 0) {
    const newLocationRelationsData = validatedFullStory.locationRelations.map((original) => {
      const newId = nextId(original.id);
      idMap.set(original.id, newId);
      const mappedLocationAId = idMap.get(original.locationAId);
      if (!mappedLocationAId) {
        throw new Error(
          `Import Error: Location A ID ${original.locationAId} not found in ID map for location relation ${original.id}.`,
        );
      }
      const mappedLocationBId = idMap.get(original.locationBId);
      if (!mappedLocationBId) {
        throw new Error(
          `Import Error: Location B ID ${original.locationBId} not found in ID map for location relation ${original.id}.`,
        );
      }
      return {
        ...original,
        id: newId,
        storyId: targetStoryId,
        locationAId: mappedLocationAId,
        locationBId: mappedLocationBId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(
      context,
      OperationLogEntityType.LocationRelation,
      newLocationRelationsData,
    );
  }

  // --- Scenes ---
  const newScenesData = validatedFullStory.scenes.map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    const mappedChapterId = original.chapterId ? idMap.get(original.chapterId) : null;
    if (original.chapterId && !mappedChapterId) {
      throw new Error(
        `Import Error: Chapter ID ${original.chapterId} not found in ID map for scene ${original.id}.`,
      );
    }
    /*
     * A scene may have no place at all, which is not the same as naming one that is missing.
     * The first is nothing to map; the second is a broken package and still refuses.
     */
    const mappedLocationId = original.locationId ? idMap.get(original.locationId) : null;
    if (original.locationId && !mappedLocationId) {
      throw new Error(
        `Import Error: Location ID ${original.locationId} not found in ID map for scene ${original.id}.`,
      );
    }
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      chapterId: mappedChapterId ?? null,
      locationId: mappedLocationId, // Use strictly mapped locationId
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  if (newScenesData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.Scene, newScenesData);
  }

  await normalizeImportedLinearSceneFlags(context);

  // --- Choices ---
  const newChoicesData = validatedFullStory.choices.map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    const mappedSceneId = idMap.get(original.sceneId);
    if (!mappedSceneId) {
      throw new Error(
        `Import Error: Scene ID ${original.sceneId} not found in ID map for choice ${original.id}.`,
      );
    }
    const mappedNextSceneId = idMap.get(original.nextSceneId);
    if (!mappedNextSceneId) {
      throw new Error(
        `Import Error: Next Scene ID ${original.nextSceneId} not found in ID map for choice ${original.id}.`,
      );
    }
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      sceneId: mappedSceneId,
      nextSceneId: mappedNextSceneId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  if (newChoicesData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.Choice, newChoicesData);
  }
}

import { OperationLogEntityType } from '@keres/shared';
import type { DatabaseStoryPackageImportContext } from './DatabaseStoryPackageImportContext';
import { insertPortableCollection } from './DatabaseStoryPackageCollectionRepository';

/**
 * Prepares collections that depend on the complete entity graph: generic relations, comments, stats,
 * modes, and favourites. It runs last so polymorphic references can be resolved.
 */
export async function importStoryFinalCollections(
  context: DatabaseStoryPackageImportContext,
): Promise<void> {
  const { fullStory: validatedFullStory, idMap, nextId, now, targetStoryId, userId } = context;
  if (validatedFullStory.seeAlsoRelations && validatedFullStory.seeAlsoRelations.length > 0) {
    const newSeeAlsoRelationsData = validatedFullStory.seeAlsoRelations.map((original) => {
      const entityAId = idMap.get(original.entityAId);
      const entityBId = idMap.get(original.entityBId);
      if (!entityAId || !entityBId) {
        throw new Error(
          `Import Error: See-also relation ${original.id} references an entity absent from the export.`,
        );
      }
      return {
        ...original,
        id: nextId(original.id),
        storyId: targetStoryId,
        entityAId,
        entityBId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(
      context,
      OperationLogEntityType.SeeAlsoRelation,
      newSeeAlsoRelationsData,
    );
  }

  if (validatedFullStory.comments && validatedFullStory.comments.length > 0) {
    const newCommentsData = validatedFullStory.comments.map((original) => {
      const entityId = idMap.get(original.entityId);
      const fieldId = original.fieldId ? idMap.get(original.fieldId) : null;
      if (!entityId) {
        throw new Error(
          `Import Error: Comment ${original.id} references an entity absent from the export.`,
        );
      }
      if (original.fieldId && !fieldId) {
        throw new Error(
          `Import Error: Comment ${original.id} references a custom field absent from the export.`,
        );
      }
      return {
        ...original,
        id: nextId(original.id),
        storyId: targetStoryId,
        entityId,
        fieldId,
        // Imported comments belong to the user who imported them, like Favorites: the author from another
        // server may not even exist in this database.
        authorUserId: userId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(context, OperationLogEntityType.Comment, newCommentsData);
  }

  // --- Stat system ---
  // A mandatory order: Stat and Mode before StatStrength/StatRelation, which reference them.
  if (validatedFullStory.stats && validatedFullStory.stats.length > 0) {
    const newStatsData = validatedFullStory.stats.map((original) => {
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
    await insertPortableCollection(context, OperationLogEntityType.Stat, newStatsData);
  }

  if (validatedFullStory.modes && validatedFullStory.modes.length > 0) {
    const newModesData = validatedFullStory.modes.map((original) => {
      const newId = nextId(original.id);
      idMap.set(original.id, newId);
      const characterId = idMap.get(original.characterId);
      if (!characterId) {
        throw new Error(
          `Import Error: Mode ${original.id} references a character absent from the export.`,
        );
      }
      return {
        ...original,
        id: newId,
        storyId: targetStoryId,
        characterId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(context, OperationLogEntityType.Mode, newModesData);
  }

  if (validatedFullStory.statStrengths && validatedFullStory.statStrengths.length > 0) {
    const newStatStrengthsData = validatedFullStory.statStrengths.map((original) => {
      const newId = nextId(original.id);
      idMap.set(original.id, newId);
      // A null statId is the story's default ladder, which references no stat at all.
      const statId = original.statId ? idMap.get(original.statId) : null;
      if (original.statId && !statId) {
        throw new Error(
          `Import Error: Stat tier ${original.id} references a stat absent from the export.`,
        );
      }
      return {
        ...original,
        id: newId,
        storyId: targetStoryId,
        statId: statId ?? null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(
      context,
      OperationLogEntityType.StatStrength,
      newStatStrengthsData,
    );
  }

  if (validatedFullStory.statRelations && validatedFullStory.statRelations.length > 0) {
    const newStatRelationsData = validatedFullStory.statRelations.map((original) => {
      const characterId = idMap.get(original.characterId);
      const statId = idMap.get(original.statId);
      const modeId = original.modeId ? idMap.get(original.modeId) : null;
      if (!characterId || !statId || (original.modeId && !modeId)) {
        throw new Error(
          `Import Error: Stat value ${original.id} references an entity absent from the export.`,
        );
      }
      return {
        ...original,
        id: nextId(original.id),
        storyId: targetStoryId,
        characterId,
        statId,
        modeId: modeId ?? null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(
      context,
      OperationLogEntityType.StatRelation,
      newStatRelationsData,
    );
  }

  if (validatedFullStory.favorites && validatedFullStory.favorites.length > 0) {
    const newFavoritesData = validatedFullStory.favorites.map((original) => {
      const mappedEntityId = idMap.get(original.entityId);
      if (!mappedEntityId) {
        throw new Error(
          `Import Error: Entity ID ${original.entityId} (${original.entityType}) not found for favorite ${original.id}.`,
        );
      }
      return {
        ...original,
        id: nextId(original.id),
        storyId: targetStoryId,
        entityId: mappedEntityId,
        userId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(context, OperationLogEntityType.Favorite, newFavoritesData);
  }
}

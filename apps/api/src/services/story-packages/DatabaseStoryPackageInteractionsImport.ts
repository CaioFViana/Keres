import { AttributeType, OperationLogEntityType } from '@keres/shared';
import type { DatabaseStoryPackageImportContext } from './DatabaseStoryPackageImportContext';
import { insertPortableCollection } from './DatabaseStoryPackageCollectionRepository';

/**
 * Prepares gameplay and presentation interactions — checks, effects, journeys, relations, and custom
 * attributes — after the entities they reference have been mapped by earlier phases.
 */
export async function importStoryInteractions(
  context: DatabaseStoryPackageImportContext,
): Promise<void> {
  const { fullStory: validatedFullStory, idMap, nextId, now, targetStoryId } = context;
  // --- ChoiceCheckGroups (Optional, map choice ID) ---
  // After Choices on purpose: choiceId has to already be in the idMap.
  if (validatedFullStory.choiceCheckGroups && validatedFullStory.choiceCheckGroups.length > 0) {
    const newChoiceCheckGroupsData = validatedFullStory.choiceCheckGroups.map((original) => {
      const newId = nextId(original.id);
      idMap.set(original.id, newId);
      const mappedChoiceId = idMap.get(original.choiceId);
      if (!mappedChoiceId) {
        throw new Error(
          `Import Error: Choice ID ${original.choiceId} not found in ID map for choice check group ${original.id}.`,
        );
      }
      return {
        ...original,
        id: newId,
        storyId: targetStoryId,
        choiceId: mappedChoiceId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(
      context,
      OperationLogEntityType.ChoiceCheckGroup,
      newChoiceCheckGroupsData,
    );
  }

  // --- ChoiceChecks (Optional, map group ID, and optional scene/item IDs) ---
  // After ChoiceCheckGroups, Scenes and Items on purpose: groupId/sceneId/itemId have to already be in
  // the idMap.
  if (validatedFullStory.choiceChecks && validatedFullStory.choiceChecks.length > 0) {
    const newChoiceChecksData = validatedFullStory.choiceChecks.map((original) => {
      const newId = nextId(original.id);
      idMap.set(original.id, newId);
      const mappedGroupId = idMap.get(original.groupId);
      if (!mappedGroupId) {
        throw new Error(
          `Import Error: Group ID ${original.groupId} not found in ID map for choice check ${original.id}.`,
        );
      }
      let mappedSceneId: string | null = null;
      if (original.sceneId) {
        mappedSceneId = idMap.get(original.sceneId) ?? null;
        if (!mappedSceneId) {
          throw new Error(
            `Import Error: Scene ID ${original.sceneId} not found in ID map for choice check ${original.id}.`,
          );
        }
      }
      let mappedItemId: string | null = null;
      if (original.itemId) {
        mappedItemId = idMap.get(original.itemId) ?? null;
        if (!mappedItemId) {
          throw new Error(
            `Import Error: Item ID ${original.itemId} not found in ID map for choice check ${original.id}.`,
          );
        }
      }
      return {
        ...original,
        id: newId,
        storyId: targetStoryId,
        groupId: mappedGroupId,
        sceneId: mappedSceneId,
        itemId: mappedItemId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(
      context,
      OperationLogEntityType.ChoiceCheck,
      newChoiceChecksData,
    );
  }

  // --- Effects (Optional, map polymorphic entity ID via entityType, and optional item ID) ---
  // After Scenes, Choices and Items on purpose: entityId (Scene or Choice) and itemId have to already
  // be in the idMap.
  if (validatedFullStory.effects && validatedFullStory.effects.length > 0) {
    const newEffectsData = validatedFullStory.effects.map((original) => {
      const newId = nextId(original.id);
      idMap.set(original.id, newId);
      const mappedEntityId = idMap.get(original.entityId);
      if (!mappedEntityId) {
        throw new Error(
          `Import Error: Entity ID ${original.entityId} (${original.entityType}) not found in ID map for effect ${original.id}.`,
        );
      }
      let mappedItemId: string | null = null;
      if (original.itemId) {
        mappedItemId = idMap.get(original.itemId) ?? null;
        if (!mappedItemId) {
          throw new Error(
            `Import Error: Item ID ${original.itemId} not found in ID map for effect ${original.id}.`,
          );
        }
      }
      return {
        ...original,
        id: newId,
        storyId: targetStoryId,
        entityId: mappedEntityId,
        itemId: mappedItemId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(context, OperationLogEntityType.Effect, newEffectsData);
  }

  // --- ItemJourneys (Optional, map item ID, scene ID, and optional new owner character ID) ---
  if (validatedFullStory.itemJourneys && validatedFullStory.itemJourneys.length > 0) {
    const newItemJourneysData = validatedFullStory.itemJourneys.map((original) => {
      const newId = nextId(original.id);
      idMap.set(original.id, newId);
      const mappedItemId = idMap.get(original.itemId);
      if (!mappedItemId) {
        throw new Error(
          `Import Error: Item ID ${original.itemId} not found in ID map for item journey ${original.id}.`,
        );
      }
      const mappedSceneId = idMap.get(original.sceneId);
      if (!mappedSceneId) {
        throw new Error(
          `Import Error: Scene ID ${original.sceneId} not found in ID map for item journey ${original.id}.`,
        );
      }
      let mappedNewCharacterOwnerId: string | null = null;
      if (original.newCharacterOwnerId) {
        mappedNewCharacterOwnerId = idMap.get(original.newCharacterOwnerId) ?? null;
        if (!mappedNewCharacterOwnerId) {
          throw new Error(
            `Import Error: Character ID ${original.newCharacterOwnerId} not found in ID map for item journey ${original.id}.`,
          );
        }
      }
      return {
        ...original,
        id: newId,
        storyId: targetStoryId,
        itemId: mappedItemId,
        sceneId: mappedSceneId,
        newCharacterOwnerId: mappedNewCharacterOwnerId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(
      context,
      OperationLogEntityType.ItemJourney,
      newItemJourneysData,
    );
  }

  // --- TagRelations (Optional, map relation ID and tag ID) ---
  if (validatedFullStory.tagRelations && validatedFullStory.tagRelations.length > 0) {
    const newTagRelationsData = validatedFullStory.tagRelations.map((original) => {
      const newId = nextId(original.id);
      idMap.set(original.id, newId);
      const mappedTagId = idMap.get(original.tagId);
      if (!mappedTagId) {
        throw new Error(
          `Import Error: Tag ID ${original.tagId} not found in ID map for tag relation ${original.id}.`,
        );
      }
      const mappedRelationId = idMap.get(original.relationId); // Corrected property name
      if (!mappedRelationId) {
        throw new Error(
          `Import Error: Relation ID ${original.relationId} not found in ID map for tag relation ${original.id}. This indicates a missing entity in export or an unhandled foreign key.`,
        );
      }

      return {
        ...original,
        id: newId,
        storyId: targetStoryId,
        tagId: mappedTagId,
        relationId: mappedRelationId, // Use mapped relationId
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(
      context,
      OperationLogEntityType.TagRelation,
      newTagRelationsData,
    );
  }

  // --- GalleryRelations (map gallery ID and owner ID) ---
  // Last on purpose: the owner can be an Item, and items only enter the id map in the block above.
  if (validatedFullStory.galleryRelations && validatedFullStory.galleryRelations.length > 0) {
    const newGalleryRelationsData = validatedFullStory.galleryRelations.map((original) => {
      const newId = nextId(original.id);
      idMap.set(original.id, newId);
      const mappedGalleryId = idMap.get(original.galleryId);
      if (!mappedGalleryId) {
        throw new Error(
          `Import Error: Gallery ID ${original.galleryId} not found in ID map for gallery relation ${original.id}.`,
        );
      }
      const mappedOwnerId = idMap.get(original.ownerId);
      if (!mappedOwnerId) {
        throw new Error(
          `Import Error: Owner ID ${original.ownerId} (${original.ownerType}) not found in ID map for gallery relation ${original.id}.`,
        );
      }

      return {
        ...original,
        id: newId,
        storyId: targetStoryId,
        galleryId: mappedGalleryId,
        ownerId: mappedOwnerId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(
      context,
      OperationLogEntityType.GalleryRelation,
      newGalleryRelationsData,
    );
  }

  // --- StorySchemaFields (Optional) ---
  // It only depends on the Story - it could go anywhere in the idMap, but it sits near AttributeValues
  // (which depend on it) for readability.
  if (validatedFullStory.storySchemaFields && validatedFullStory.storySchemaFields.length > 0) {
    const newStorySchemaFieldsData = validatedFullStory.storySchemaFields.map((original) => {
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
    await insertPortableCollection(
      context,
      OperationLogEntityType.StorySchemaField,
      newStorySchemaFieldsData,
    );
  }

  // Attribute values of entity fields store another entity's ID. Those IDs
  // belong to the source export, so remap them just like other references.
  // Missing targets are intentionally preserved as dangling references by
  // clearing the value instead of aborting the whole import.
  const entityFieldIds = new Set(
    (validatedFullStory.storySchemaFields ?? [])
      .filter((field) => field.type === AttributeType.ENTITY)
      .map((field) => field.id),
  );

  // --- AttributeValues (Optional) ---
  // Last on purpose: entityId can point at any of the 7 supported entity types
  // (Character/Location/Item/Scene/Chapter/Note/WorldRule), all of which have to already be in the
  // idMap, and fieldId depends on the StorySchemaFields block above.
  if (validatedFullStory.attributeValues && validatedFullStory.attributeValues.length > 0) {
    const newAttributeValuesData = validatedFullStory.attributeValues.map((original) => {
      const newId = nextId(original.id);
      idMap.set(original.id, newId);
      const mappedFieldId = idMap.get(original.fieldId);
      if (!mappedFieldId) {
        throw new Error(
          `Import Error: Field ID ${original.fieldId} not found in ID map for attribute value ${original.id}.`,
        );
      }
      const mappedEntityId = idMap.get(original.entityId);
      if (!mappedEntityId) {
        throw new Error(
          `Import Error: Entity ID ${original.entityId} (${original.entityType}) not found in ID map for attribute value ${original.id}.`,
        );
      }
      const value =
        entityFieldIds.has(original.fieldId) && original.value
          ? (idMap.get(original.value) ?? null)
          : original.value;
      return {
        ...original,
        id: newId,
        storyId: targetStoryId,
        fieldId: mappedFieldId,
        entityId: mappedEntityId,
        value,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      };
    });
    await insertPortableCollection(
      context,
      OperationLogEntityType.AttributeValue,
      newAttributeValuesData,
    );
  }
}

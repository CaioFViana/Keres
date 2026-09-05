import { galleryHasFile } from '@keres/shared';
import type {
  AttributeValueInsert,
  ChoiceCheckInsert,
  EffectInsert,
  GalleryInsert,
  GalleryRelationInsert,
  ItemInsert,
  ItemJourneyInsert,
  NoteRelationInsert,
  StorySchemaFieldInsert,
} from '../../../db/schema';
import {
  attributeValues,
  choiceChecks,
  effects,
  galleries,
  galleryRelations,
  itemJourneys,
  items,
  noteRelations,
  storySchemaFields,
} from '../../../db/schema';
import type { SQLiteStoryPackageImportContext } from './SQLiteStoryPackageImportContext';

/**
 * Writes media, inventory, interaction and custom-field collections after their referenced
 * story entities exist. Local media paths and transfer state are retained inside the caller's
 * transaction so a package import cannot expose incomplete metadata.
 */
export async function importStoryPackageAssets(
  context: SQLiteStoryPackageImportContext,
): Promise<void> {
  const { fullStory, localMediaPaths, tx } = context;

  if (fullStory.galleryItems) {
    for (const galleryItem of fullStory.galleryItems) {
      // A `.zip` package has already brought this medium's bytes to the device before this
      // transaction began (see `ImportExportScreen.handleImport`); a plain `.json` carries only
      // metadata, and its bytes stay on the server, addressed by the hash.
      const localPath = localMediaPaths?.get(galleryItem.hash);
      const requiresFileTransfer = galleryHasFile(galleryItem.mediaType);
      const row: GalleryInsert = {
        ...galleryItem,
        storyId: galleryItem.storyId,
        createdAt: new Date(galleryItem.createdAt),
        updatedAt: new Date(),
        version: galleryItem.version,
        isDeleted: false,
        deletedAt: null,
        localPath: localPath ?? null,
        // A link is complete metadata, not a file. It must never enter either transfer queue.
        uploadState: requiresFileTransfer && localPath ? 'pending' : 'uploaded',
        downloadState: requiresFileTransfer && !localPath ? 'pending' : 'downloaded',
      };
      await tx.insert(galleries).values(row).run();
    }
  }

  if (fullStory.galleryRelations) {
    for (const relation of fullStory.galleryRelations) {
      const row: GalleryRelationInsert = {
        ...relation,
        storyId: relation.storyId,
        createdAt: new Date(relation.createdAt),
        updatedAt: new Date(),
        version: relation.version,
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(galleryRelations).values(row).run();
    }
  }

  if (fullStory.items) {
    for (const item of fullStory.items) {
      const row: ItemInsert = {
        ...item,
        storyId: item.storyId,
        characterOwnerId: item.characterOwnerId,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(),
        version: item.version,
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(items).values(row).run();
    }
  }

  // Inventory checks and item grant/take effects have foreign keys to the item table.
  if (fullStory.choiceChecks) {
    for (const check of fullStory.choiceChecks) {
      const row: ChoiceCheckInsert = {
        ...check,
        storyId: check.storyId,
        groupId: check.groupId,
        createdAt: new Date(check.createdAt),
        updatedAt: new Date(),
        version: check.version,
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(choiceChecks).values(row).run();
    }
  }
  if (fullStory.effects) {
    for (const effect of fullStory.effects) {
      const row: EffectInsert = {
        ...effect,
        storyId: effect.storyId,
        entityType: effect.entityType,
        entityId: effect.entityId,
        createdAt: new Date(effect.createdAt),
        updatedAt: new Date(),
        version: effect.version,
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(effects).values(row).run();
    }
  }

  if (fullStory.itemJourneys) {
    for (const journey of fullStory.itemJourneys) {
      const row: ItemJourneyInsert = {
        ...journey,
        storyId: journey.storyId,
        itemId: journey.itemId,
        sceneId: journey.sceneId,
        newCharacterOwnerId: journey.newCharacterOwnerId,
        createdAt: new Date(journey.createdAt),
        updatedAt: new Date(),
        version: journey.version,
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(itemJourneys).values(row).run();
    }
  }

  if (fullStory.noteRelations) {
    for (const relation of fullStory.noteRelations) {
      const row: NoteRelationInsert = {
        ...relation,
        storyId: relation.storyId,
        noteId: relation.noteId,
        relationId: relation.relationId,
        relationType: relation.relationType,
        createdAt: new Date(relation.createdAt),
        updatedAt: new Date(),
        version: relation.version,
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(noteRelations).values(row).run();
    }
  }

  if (fullStory.storySchemaFields) {
    for (const field of fullStory.storySchemaFields) {
      const row: StorySchemaFieldInsert = {
        ...field,
        storyId: field.storyId,
        createdAt: new Date(field.createdAt),
        updatedAt: new Date(),
        version: field.version,
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(storySchemaFields).values(row).run();
    }
  }

  // Values come last: fieldId depends on the previous collection, and entityId can target any
  // supported entity. Local clones already have remapped IDs at this point.
  if (fullStory.attributeValues) {
    for (const value of fullStory.attributeValues) {
      const row: AttributeValueInsert = {
        ...value,
        storyId: value.storyId,
        fieldId: value.fieldId,
        entityId: value.entityId,
        createdAt: new Date(value.createdAt),
        updatedAt: new Date(),
        version: value.version,
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(attributeValues).values(row).run();
    }
  }
}

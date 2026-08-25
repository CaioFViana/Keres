import type {
  CreateItemDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate} from '@keres/shared';
import {
  CreateItemDataSchema,
  PartialItemSchema
} from '@keres/shared';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '../../db';
import { characters, items } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class ItemSyncHandler extends BaseSyncEntityHandler<
  typeof CreateItemDataSchema,
  typeof PartialItemSchema
> {
  entityName = 'Item';

  constructor() {
    super('items', 'id', 'version', CreateItemDataSchema, PartialItemSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  private async validateCharacterOwner(
    storyId: string,
    characterOwnerId: string | null,
  ): Promise<void> {
    if (characterOwnerId) {
      const characterExists = await db.query.characters.findFirst({
        where: and(
          eq(characters.id, characterOwnerId),
          eq(characters.storyId, storyId),
          eq(characters.isDeleted, false),
        ),
      });
      if (!characterExists) {
        throw new SyncConflictError(
          'referenced_entity_deleted',
          `Validation Error: Character with ID ${characterOwnerId} not found, is deleted, or does not belong to story ${storyId}.`,
        );
      }
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateItemDataType = this.createSchema.parse(update.data);

    // Validate characterOwnerId if present
    await this.validateCharacterOwner(storyId, validatedData.characterOwnerId);

    // Check for existing item with the same name within the same story
    const existingItem = await db.query.items.findFirst({
      where: and(
        eq(items.storyId, storyId),
        eq(items.name, validatedData.name),
        eq(items.isDeleted, false),
      ),
    });

    if (existingItem) {
      throw new Error(
        `Conflict: Item with name "${validatedData.name}" already exists in story ${storyId}.`,
      );
    }

    await db.insert(items).values({
      id: update.id!,
      storyId: storyId,
      characterOwnerId: validatedData.characterOwnerId,
      name: validatedData.name,
      category: validatedData.category,
      description: validatedData.description,
      initialState: validatedData.initialState,
      isFavorite: validatedData.isFavorite,
      extraNotes: validatedData.extraNotes,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    // Validate characterOwnerId if it's being updated
    if (validatedChanges.characterOwnerId !== undefined) {
      await this.validateCharacterOwner(storyId, validatedChanges.characterOwnerId);
    }

    // If the name is being updated, check for uniqueness within the story
    if (validatedChanges.name && validatedChanges.name !== currentEntity.name) {
      const existingItem = await db.query.items.findFirst({
        where: and(
          eq(items.storyId, storyId),
          eq(items.name, validatedChanges.name),
          eq(items.isDeleted, false),
          ne(items.id, update.id!), // Exclude the current item from the check
        ),
      });

      if (existingItem) {
        throw new Error(
          `Conflict: Item with name "${validatedChanges.name}" already exists in story ${storyId}.`,
        );
      }
    }

    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
  }
}

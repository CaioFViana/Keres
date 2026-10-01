import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  CreateItemDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateItemDataSchema, PartialItemSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { characters, items } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class ItemSyncHandler extends BaseSyncEntityHandler<
  typeof CreateItemDataSchema,
  typeof PartialItemSchema
> {
  entityName = 'Item';

  constructor() {
    super('id', 'version', CreateItemDataSchema, PartialItemSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  private async validateCharacterOwner(
    storyId: string,
    characterOwnerId: string | null,
    database: CompatibleDb = db,
  ): Promise<void> {
    if (characterOwnerId) {
      const characterExists = await database.query.characters.findFirst({
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

  async create(
    userId: string,
    storyId: string,
    update: CreateStoryUpdate,
    database: CompatibleDb = db,
  ): Promise<void> {
    const validatedData: CreateItemDataType = this.createSchema.parse(update.data);

    // Validate characterOwnerId if present
    await this.validateCharacterOwner(storyId, validatedData.characterOwnerId, database);

    // No uniqueness by name: two items are two things, whatever they are called. Two devices can
    // name one alike offline, and refusing the second (or folding it into the first, with the
    // journeys, effects and checks that point at it) would lose one of them.

    await database.insert(items).values({
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
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    // Validate characterOwnerId if it's being updated
    if (validatedChanges.characterOwnerId !== undefined) {
      await this.validateCharacterOwner(storyId, validatedChanges.characterOwnerId, database);
    }

    await super.update(userId, storyId, update, currentEntity, database);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity, database);
  }
}

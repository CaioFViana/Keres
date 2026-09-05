import type { CreateModeDataType, CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { CreateModeDataSchema, PartialModeSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { characters, modes } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class ModeSyncHandler extends BaseSyncEntityHandler<
  typeof CreateModeDataSchema,
  typeof PartialModeSchema
> {
  entityName = 'Mode';

  constructor() {
    super('id', 'version', CreateModeDataSchema, PartialModeSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  private async assertCharacterExists(storyId: string, characterId: string): Promise<void> {
    const character = await db.query.characters.findFirst({
      where: and(
        eq(characters.id, characterId),
        eq(characters.storyId, storyId),
        eq(characters.isDeleted, false),
      ),
    });
    if (!character) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Character with ID ${characterId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateModeDataType = this.createSchema.parse(update.data);

    const existing = await this.findById(update.id!);
    if (existing) {
      throw new Error(`Conflict: Mode with ID ${update.id} already exists.`);
    }

    await this.assertCharacterExists(storyId, validatedData.characterId);

    await db.insert(modes).values({
      id: update.id!,
      storyId,
      characterId: validatedData.characterId,
      name: validatedData.name,
      modeChanges: validatedData.modeChanges,
      order: validatedData.order,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
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

    if (validatedChanges.characterId !== undefined) {
      await this.assertCharacterExists(storyId, validatedChanges.characterId);
    }

    await super.update(userId, storyId, update, currentEntity);
  }
}

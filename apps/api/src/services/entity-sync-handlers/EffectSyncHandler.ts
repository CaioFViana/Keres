import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { CreateEffectDataSchema, PartialEffectSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { effects, items } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class EffectSyncHandler extends BaseSyncEntityHandler<
  typeof CreateEffectDataSchema,
  typeof PartialEffectSchema
> {
  entityName = 'Effect';

  constructor() {
    super('id', 'version', CreateEffectDataSchema, PartialEffectSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  // No existence validation for entityId (Scene or Choice) - polymorphic, no database FK, the same
  // pattern as CommentSyncHandler for entityType/entityId.
  private async validateRelatedEntities(storyId: string, itemId: string | null): Promise<void> {
    if (itemId) {
      const itemExists = await db.query.items.findFirst({
        where: and(eq(items.id, itemId), eq(items.storyId, storyId), eq(items.isDeleted, false)),
      });
      if (!itemExists) {
        throw new SyncConflictError(
          'referenced_entity_deleted',
          `Validation Error: Item with ID ${itemId} not found, is deleted, or does not belong to story ${storyId}.`,
        );
      }
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData = this.createSchema.parse(update.data);

    await this.validateRelatedEntities(storyId, validatedData.itemId);

    const currentEffect = await this.findById(update.id!);
    if (currentEffect) {
      throw new Error(`Conflict: Effect with ID ${update.id} already exists.`);
    }

    await db.insert(effects).values({
      id: update.id!,
      storyId: storyId,
      entityType: validatedData.entityType,
      entityId: validatedData.entityId,
      effectType: validatedData.effectType,
      itemId: validatedData.itemId,
      triggerName: validatedData.triggerName,
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
  ): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    if (validatedChanges.itemId !== undefined) {
      await this.validateRelatedEntities(storyId, validatedChanges.itemId);
    }

    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
  ): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
  }
}

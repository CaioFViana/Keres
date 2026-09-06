import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  CreateStorySchemaFieldDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import {
  AttributeType,
  CreateStorySchemaFieldDataSchema,
  PartialStorySchemaFieldSchema,
} from '@keres/shared';
import { and, eq, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../../db';
import { storySchemaFields } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class StorySchemaFieldSyncHandler extends BaseSyncEntityHandler<
  typeof CreateStorySchemaFieldDataSchema,
  typeof PartialStorySchemaFieldSchema
> {
  entityName = 'StorySchemaField';

  constructor() {
    super('id', 'version', CreateStorySchemaFieldDataSchema, PartialStorySchemaFieldSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateStorySchemaFieldDataType = this.createSchema.parse(update.data);

    const existingField = await db.query.storySchemaFields.findFirst({
      where: and(
        eq(storySchemaFields.storyId, storyId),
        eq(storySchemaFields.entityType, validatedData.entityType),
        eq(storySchemaFields.key, validatedData.key),
        eq(storySchemaFields.isDeleted, false),
      ),
    });

    if (existingField) {
      throw new Error(
        `Conflict: Attribute with key "${validatedData.key}" already exists for ${validatedData.entityType} in story ${storyId}.`,
      );
    }

    if (validatedData.type === AttributeType.ENTITY && !validatedData.targetEntityType) {
      throw new Error('Entity attributes require a target entity type.');
    }

    await db.insert(storySchemaFields).values({
      id: update.id!,
      storyId,
      entityType: validatedData.entityType,
      name: validatedData.name,
      key: validatedData.key,
      description: validatedData.description,
      type: validatedData.type,
      targetEntityType: validatedData.targetEntityType,
      isRequired: validatedData.isRequired,
      defaultValue: validatedData.defaultValue,
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
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
  ): Promise<void> {
    // entityType and key are immutable after creation: AttributeValue references the field by fieldId (not
    // by key), so nothing would technically break, but changing the entity type or the key underneath
    // already-saved values would leave them with an inconsistent label/type and no warning at all - the
    // management UI never offers that option, and the server does not rely on that alone: it ignores those
    // two keys right here even if an old/tampered-with client sends them.
    const changes = { ...update.changes };
    delete changes.entityType;
    delete changes.key;
    delete changes.type;
    delete changes.targetEntityType;

    await super.update(userId, storyId, { ...update, changes }, currentEntity);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
  ): Promise<void> {
    const alreadyDeleted = !!currentEntity.isDeleted;
    await super.delete(userId, storyId, update, currentEntity);

    if (alreadyDeleted) {
      // An idempotent resend of the same deletion - the key mutation already ran the first time.
      return;
    }

    // It frees the slot of the unique(storyId, entityType, key) constraint, which is not filtered by
    // isDeleted - without that, recreating an attribute with the same key after deleting the old one would
    // fail against the tombstone row. It only affects this very row (never read back by anyone other than
    // that constraint), so it does not need to be propagated to other clients.
    //
    // Cascading to AttributeValue is the CLIENT's responsibility (StorySchemaFieldService.deleteField), not
    // this file's: a direct SQL mutation on this table does not go through the operationLog, so other
    // devices would never learn about the cascade through a pull - the client has to send explicit
    // AttributeValue deletions in the same batch, each following the normal path
    // (AttributeValueSyncHandler.delete), for it to synchronize correctly.
    await db
      .update(storySchemaFields)
      .set({ key: sql`${storySchemaFields.key} || '__deleted_' || ${ulid()}` })
      .where(eq(storySchemaFields.id, update.id!));
  }
}

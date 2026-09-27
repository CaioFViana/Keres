import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  CreateStorySchemaFieldDataType,
  CreateStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import {
  AttributeType,
  CreateStorySchemaFieldDataSchema,
  PartialStorySchemaFieldSchema,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { storySchemaFields } from '../../db/schema';
import { BaseSyncEntityHandler, duplicateOf } from './BaseSyncEntityHandler';

export class StorySchemaFieldSyncHandler extends BaseSyncEntityHandler<
  typeof CreateStorySchemaFieldDataSchema,
  typeof PartialStorySchemaFieldSchema
> {
  entityName = 'StorySchemaField';
  readonly naturalKey = ['entityType', 'key'] as const;

  constructor() {
    super('id', 'version', CreateStorySchemaFieldDataSchema, PartialStorySchemaFieldSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(
    userId: string,
    storyId: string,
    update: CreateStoryUpdate,
    database: CompatibleDb = db,
  ): Promise<void> {
    const validatedData: CreateStorySchemaFieldDataType = this.createSchema.parse(update.data);

    const existingField = await database.query.storySchemaFields.findFirst({
      where: and(
        eq(storySchemaFields.storyId, storyId),
        eq(storySchemaFields.entityType, validatedData.entityType),
        eq(storySchemaFields.key, validatedData.key),
        eq(storySchemaFields.isDeleted, false),
      ),
    });

    if (existingField) {
      throw duplicateOf(
        existingField,
        `Conflict: Attribute with key "${validatedData.key}" already exists for ${validatedData.entityType} in story ${storyId}.`,
      );
    }

    if (validatedData.type === AttributeType.ENTITY && !validatedData.targetEntityType) {
      throw new Error('Entity attributes require a target entity type.');
    }

    await database.insert(storySchemaFields).values({
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
      // Always set by the push (normalizeArrangedUpdate); empty would take its order's legacy rank.
      rank: validatedData.rank ?? '',
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
    database: CompatibleDb = db,
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

    await super.update(userId, storyId, { ...update, changes }, currentEntity, database);
  }
}

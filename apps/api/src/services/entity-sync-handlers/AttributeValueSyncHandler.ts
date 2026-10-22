import type { SyncStoredEntityFor, SyncWriteContext } from './BaseSyncEntityHandler';
import type {
  CreateAttributeValueDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateAttributeValueDataSchema, PartialAttributeValueSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { attributeValues, storySchemaFields } from '@/db/schema';
import { BaseSyncEntityHandler, SyncConflictError, duplicateOf } from './BaseSyncEntityHandler';

/**
 * Sync handler for custom-attribute values. Both links are story-scoped here: the field must be one
 * of this story's schema fields for the same entity type, and the entity one of this story's live
 * rows. The table's uniqueness is global, so an unchecked create could squat another story's
 * (entity, field) pair - blocking its owner's value for good - and confirm that it exists.
 */

export class AttributeValueSyncHandler extends BaseSyncEntityHandler<
  typeof CreateAttributeValueDataSchema,
  typeof PartialAttributeValueSchema
> {
  entityName = 'AttributeValue';
  readonly naturalKey = ['entityId', 'fieldId'] as const;
  // A value belongs to one (entity, field) pair for life: repointing it would bypass every check
  // the create made.
  protected fixedFields = ['entityType', 'entityId', 'fieldId'] as const;

  constructor() {
    super('id', 'version', CreateAttributeValueDataSchema, PartialAttributeValueSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(update: CreateStoryUpdate, ctx: SyncWriteContext): Promise<void> {
    const { storyId, database = db } = ctx;
    const validatedData: CreateAttributeValueDataType = this.createSchema.parse(update.data);
    const field = await database.query.storySchemaFields.findFirst({
      where: and(
        eq(storySchemaFields.id, validatedData.fieldId),
        eq(storySchemaFields.storyId, storyId),
      ),
      columns: { entityType: true },
    });
    if (!field || field.entityType !== validatedData.entityType) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Field ${validatedData.fieldId} is not a ${validatedData.entityType} field of story ${storyId}.`,
      );
    }
    await this.assertEntityInStory(
      validatedData.entityType,
      validatedData.entityId,
      storyId,
      database,
    );

    const existingValue = await database.query.attributeValues.findFirst({
      where: and(
        eq(attributeValues.storyId, storyId),
        eq(attributeValues.entityId, validatedData.entityId),
        eq(attributeValues.fieldId, validatedData.fieldId),
        eq(attributeValues.isDeleted, false),
      ),
    });

    if (existingValue) {
      throw duplicateOf(
        existingValue,
        `Conflict: An attribute value already exists for entity ${validatedData.entityId} / field ${validatedData.fieldId}.`,
      );
    }

    await database.insert(attributeValues).values({
      id: update.id!,
      storyId,
      entityType: validatedData.entityType,
      entityId: validatedData.entityId,
      fieldId: validatedData.fieldId,
      value: validatedData.value,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(
    update: UpdateStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    ctx: SyncWriteContext,
  ): Promise<void> {
    await super.update(update, currentEntity, ctx);
  }

  async delete(
    update: DeleteStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    ctx: SyncWriteContext,
  ): Promise<void> {
    await super.delete(update, currentEntity, ctx);
  }
}

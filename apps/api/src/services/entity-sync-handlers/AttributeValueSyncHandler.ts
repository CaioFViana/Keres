import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  CreateAttributeValueDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateAttributeValueDataSchema, PartialAttributeValueSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { attributeValues } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class AttributeValueSyncHandler extends BaseSyncEntityHandler<
  typeof CreateAttributeValueDataSchema,
  typeof PartialAttributeValueSchema
> {
  entityName = 'AttributeValue';

  constructor() {
    super('id', 'version', CreateAttributeValueDataSchema, PartialAttributeValueSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate, database: CompatibleDb = db): Promise<void> {
    const validatedData: CreateAttributeValueDataType = this.createSchema.parse(update.data);

    const existingValue = await database.query.attributeValues.findFirst({
      where: and(
        eq(attributeValues.entityId, validatedData.entityId),
        eq(attributeValues.fieldId, validatedData.fieldId),
        eq(attributeValues.isDeleted, false),
      ),
    });

    if (existingValue) {
      throw new Error(
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
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
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

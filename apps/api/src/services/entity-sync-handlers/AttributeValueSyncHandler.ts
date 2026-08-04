import {
  CreateAttributeValueDataSchema,
  CreateAttributeValueDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  PartialAttributeValueSchema,
  UpdateStoryUpdate,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { attributeValues } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class AttributeValueSyncHandler extends BaseSyncEntityHandler<typeof CreateAttributeValueDataSchema, typeof PartialAttributeValueSchema> {
  entityName = 'AttributeValue';

  constructor() {
    super(
      'attributeValues',
      'id',
      'version',
      CreateAttributeValueDataSchema,
      PartialAttributeValueSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateAttributeValueDataType = this.createSchema.parse(update.data);

    const existingValue = await db.query.attributeValues.findFirst({
      where: and(
        eq(attributeValues.entityId, validatedData.entityId),
        eq(attributeValues.fieldId, validatedData.fieldId),
        eq(attributeValues.isDeleted, false)
      ),
    });

    if (existingValue) {
      throw new Error(`Conflict: An attribute value already exists for entity ${validatedData.entityId} / field ${validatedData.fieldId}.`);
    }

    await db.insert(attributeValues).values({
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

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(userId: string, storyId: string, update: DeleteStoryUpdate, currentEntity: any): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
  }
}

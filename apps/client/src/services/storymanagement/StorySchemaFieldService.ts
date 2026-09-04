import type { StorySchemaEntityType } from '@keres/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { StorySchemaFieldInsert, StorySchemaFieldSelect } from '../../db/schema';
import { attributeValues, storySchemaFields, stories } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { createULID, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import { countActiveStoryEntities } from './storyEntityCount';

export interface StorySchemaFieldService {
  getCustomAttributeCount(storyId?: string): Promise<number>;
  getFieldsByStoryAndEntityType(
    storyId: string,
    entityType: StorySchemaEntityType,
  ): Promise<StorySchemaFieldSelect[]>;
  getById(fieldId: string): Promise<StorySchemaFieldSelect | undefined>;
  createField(
    currentUserId: string,
    fieldData: Create<StorySchemaFieldInsert>,
  ): Promise<StorySchemaFieldSelect>;
  updateField(
    currentUserId: string,
    fieldId: string,
    fieldData: Partial<
      Pick<StorySchemaFieldInsert, 'name' | 'description' | 'isRequired' | 'defaultValue' | 'order'>
    >,
  ): Promise<void>;
  reorderFields(
    currentUserId: string,
    storyId: string,
    entityType: StorySchemaEntityType,
    newOrder: { id: string; order: number }[],
  ): Promise<void>;
  deleteField(currentUserId: string, fieldId: string): Promise<void>;
}

export const createStorySchemaFieldService = (db: AppDrizzleClient): StorySchemaFieldService => {
  const serverService = createServerService(db);
  return {
    async getCustomAttributeCount(storyId?: string): Promise<number> {
      return countActiveStoryEntities(db, storySchemaFields, storyId);
    },

    async getFieldsByStoryAndEntityType(storyId, entityType): Promise<StorySchemaFieldSelect[]> {
      return db
        .select()
        .from(storySchemaFields)
        .where(
          and(
            eq(storySchemaFields.storyId, storyId),
            eq(storySchemaFields.entityType, entityType),
            eq(storySchemaFields.isDeleted, false),
          ),
        )
        .orderBy(asc(storySchemaFields.order))
        .all();
    },

    async getById(fieldId: string): Promise<StorySchemaFieldSelect | undefined> {
      return db.query.storySchemaFields.findFirst({
        where: and(eq(storySchemaFields.id, fieldId), eq(storySchemaFields.isDeleted, false)),
      });
    },

    async createField(
      currentUserId: string,
      fieldData: Create<StorySchemaFieldInsert>,
    ): Promise<StorySchemaFieldSelect> {
      await assertStoryIsWritable(db, fieldData.storyId);
      // A local check before writing: without this, a duplicate key would only fail later on,
      // as an opaque sync error instead of an immediate form error - Tag/Suggestion do not
      // make that check today, but here a key collision (frequently auto-derived from the
      // display name) is a far more likely user path.
      const existing = await db.query.storySchemaFields.findFirst({
        where: and(
          eq(storySchemaFields.storyId, fieldData.storyId),
          eq(storySchemaFields.entityType, fieldData.entityType),
          eq(storySchemaFields.key, fieldData.key),
          eq(storySchemaFields.isDeleted, false),
        ),
      });
      if (existing) {
        throw new Error(
          `An attribute with key "${fieldData.key}" already exists for ${fieldData.entityType} in this story.`,
        );
      }

      const newField = prepareNewEntityData<StorySchemaFieldInsert>(fieldData);
      const result = await db.insert(storySchemaFields).values(newField).returning().get();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newField.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        newField.storyId,
        userIdToLog,
        'create',
        'StorySchemaField',
        newField.id,
        { ...result },
      );
      entityEventEmitter.emit('story_schema_field_changed', newField.storyId, newField.entityType);

      return result;
    },

    async updateField(currentUserId, fieldId, fieldData): Promise<void> {
      const original = await db.query.storySchemaFields.findFirst({
        where: eq(storySchemaFields.id, fieldId),
      });
      if (!original) {
        throw new Error(`Attribute field with ID ${fieldId} not found for update.`);
      }
      await assertStoryIsWritable(db, original.storyId);

      const [updated] = await db
        .update(storySchemaFields)
        .set({
          ...fieldData,
          updatedAt: new Date(),
          version: sql`${storySchemaFields.version} + 1`,
        })
        .where(eq(storySchemaFields.id, fieldId))
        .returning({
          id: storySchemaFields.id,
          storyId: storySchemaFields.storyId,
          entityType: storySchemaFields.entityType,
          version: storySchemaFields.version,
        });

      if (!updated) {
        throw new Error(`Failed to update attribute field ${fieldId}.`);
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updated.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        updated.storyId,
        userIdToLog,
        'update',
        'StorySchemaField',
        fieldId,
        {
          ...fieldData,
          version: updated.version,
        },
      );
      entityEventEmitter.emit('story_schema_field_changed', updated.storyId, updated.entityType);
    },

    async reorderFields(currentUserId, storyId, entityType, newOrder): Promise<void> {
      await assertStoryIsWritable(db, storyId);

      const fields = await db
        .select({ id: storySchemaFields.id, order: storySchemaFields.order })
        .from(storySchemaFields)
        .where(
          and(
            eq(storySchemaFields.storyId, storyId),
            eq(storySchemaFields.entityType, entityType),
            eq(storySchemaFields.isDeleted, false),
          ),
        )
        .all();
      const fieldsById = new Map(fields.map((field) => [field.id, field]));

      const orderValues = newOrder.map(({ order }) => order).sort((a, b) => a - b);
      const hasSequentialOrder = orderValues.every((order, index) => order === index);
      if (
        newOrder.length !== fields.length ||
        new Set(newOrder.map(({ id }) => id)).size !== fields.length ||
        newOrder.some(({ id }) => !fieldsById.has(id)) ||
        !hasSequentialOrder
      ) {
        throw new Error('Attribute reorder must contain every field of the selected entity type.');
      }

      const changedFields = newOrder.filter(({ id, order }) => fieldsById.get(id)?.order !== order);
      if (changedFields.length === 0) return;

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      for (const field of changedFields) {
        await db
          .update(storySchemaFields)
          .set({
            order: field.order,
            updatedAt: new Date(),
            version: sql`${storySchemaFields.version} + 1`,
          })
          .where(eq(storySchemaFields.id, field.id))
          .run();
      }

      const [story] = await db
        .update(stories)
        .set({ version: sql`${stories.version} + 1`, updatedAt: new Date() })
        .where(eq(stories.id, storyId))
        .returning({ version: stories.version });

      await recordLocalOperation(db, storyId, userIdToLog, 'reorder', 'Story', storyId, {
        reorderItems: newOrder.map(({ id, order }) => ({ id, newIndex: order + 1 })),
        reorderTarget: 'StorySchemaField',
        schemaEntityType: entityType,
        version: story?.version,
      });
      entityEventEmitter.emit('story_schema_field_changed', storyId, entityType);
    },

    async deleteField(currentUserId: string, fieldId: string): Promise<void> {
      const field = await db.query.storySchemaFields.findFirst({
        where: eq(storySchemaFields.id, fieldId),
      });
      if (!field) {
        console.warn(`Attempted to delete non-existent attribute field ${fieldId}.`);
        return;
      }
      if (field.isDeleted) {
        // Already deleted (an idempotent resend) - the key mutation and the cascade have already run.
        return;
      }
      await assertStoryIsWritable(db, field.storyId);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        field.storyId,
        currentUserId,
      );
      const now = new Date();

      // It mutates the key on the soft-delete to free the unique(storyId, entityType, key) slot - the
      // local constraint (and the server's) is not filtered by isDeleted, so recreating a field
      // with the same key after deleting the old one would run into the tombstone row. It only needs to
      // hold locally (the server does its own independent mutation when processing the same
      // delete, see StorySchemaFieldSyncHandler) - nobody ever reads that mutated key back.
      const mangledKey = `${field.key}__deleted_${createULID()}`;
      const [updatedField] = await db
        .update(storySchemaFields)
        .set({
          key: mangledKey,
          isDeleted: true,
          deletedAt: now,
          updatedAt: now,
          version: sql`${storySchemaFields.version} + 1`,
        })
        .where(eq(storySchemaFields.id, fieldId))
        .returning({ id: storySchemaFields.id, version: storySchemaFields.version });

      if (!updatedField) {
        throw new Error(`Failed to delete attribute field ${fieldId}.`);
      }

      await recordLocalOperation(
        db,
        field.storyId,
        userIdToLog,
        'delete',
        'StorySchemaField',
        fieldId,
        {
          id: fieldId,
          isDeleted: true,
          version: updatedField.version,
        },
      );

      // A cascade: an orphaned AttributeValue (a fieldId pointing at a field that no longer exists)
      // has no type/label to render itself - unlike other relations in the app, which are left
      // orphaned inertly without a problem when the owning entity is deleted. Each value needs its
      // OWN operation recorded (not a direct SQL mutation) so that other devices' pull
      // genuinely learns of the deletion - see the comment in
      // StorySchemaFieldSyncHandler.delete() about why the cascade cannot live on the
      // server alone.
      const liveValues = await db
        .select({ id: attributeValues.id, version: attributeValues.version })
        .from(attributeValues)
        .where(and(eq(attributeValues.fieldId, fieldId), eq(attributeValues.isDeleted, false)))
        .all();

      for (const value of liveValues) {
        const [updatedValue] = await db
          .update(attributeValues)
          .set({
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
            version: sql`${attributeValues.version} + 1`,
          })
          .where(eq(attributeValues.id, value.id))
          .returning({ id: attributeValues.id, version: attributeValues.version });

        if (!updatedValue) {
          continue;
        }

        await recordLocalOperation(
          db,
          field.storyId,
          userIdToLog,
          'delete',
          'AttributeValue',
          value.id,
          {
            id: value.id,
            isDeleted: true,
            version: updatedValue.version,
          },
        );
      }

      entityEventEmitter.emit('story_schema_field_changed', field.storyId, field.entityType);
    },
  };
};

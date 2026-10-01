import type { StorySchemaEntityType } from '@keres/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { StorySchemaFieldInsert, StorySchemaFieldSelect } from '../../db/schema';
import { storySchemaFields } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import { createAttributeValueService } from './AttributeValueService';
import { planContainerOrderSync, planPlacementSync, writeRankChangesSync } from './arrangedWrites';
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
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newField.storyId,
        currentUserId,
      );
      const result = await runLocalWrite(db, newField.storyId, () => {
        // The asked order is where it goes among its type's fields; the database numbers it.
        const placement = planPlacementSync(
          db,
          'StorySchemaField',
          newField.storyId,
          { entityType: newField.entityType },
          newField.id,
          typeof fieldData.order === 'number' ? fieldData.order : undefined,
        );
        db.insert(storySchemaFields)
          .values({ ...newField, rank: placement.get(newField.id)! })
          .run();
        // Recorded as the database holds it: its number already derived from its rank.
        const inserted = db
          .select()
          .from(storySchemaFields)
          .where(eq(storySchemaFields.id, newField.id))
          .get()!;
        recordLocalOperationSync(
          db,
          newField.storyId,
          userIdToLog,
          'create',
          'StorySchemaField',
          newField.id,
          { ...inserted },
        );
        writeRankChangesSync(
          db,
          newField.storyId,
          userIdToLog,
          'StorySchemaField',
          placement,
          new Set([newField.id]),
        );
        return db
          .select()
          .from(storySchemaFields)
          .where(eq(storySchemaFields.id, newField.id))
          .get()!;
      });
      entityEventEmitter.emit('story_schema_field_changed', newField.storyId, newField.entityType);

      return result;
    },

    async updateField(currentUserId, fieldId, requested): Promise<void> {
      // A field's place is its rank (reorderFields); the order a form holds is never written.
      const { order: _order, ...fieldData } = requested;
      const original = await db.query.storySchemaFields.findFirst({
        where: eq(storySchemaFields.id, fieldId),
      });
      if (!original) {
        throw new Error(`Attribute field with ID ${fieldId} not found for update.`);
      }
      await assertStoryIsWritable(db, original.storyId);
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        original.storyId,
        currentUserId,
      );

      const updated = await runLocalWrite(db, original.storyId, () => {
        const row = db
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
          })
          .get();
        if (!row) {
          throw new Error(`Failed to update attribute field ${fieldId}.`);
        }
        recordLocalOperationSync(
          db,
          row.storyId,
          userIdToLog,
          'update',
          'StorySchemaField',
          fieldId,
          {
            ...fieldData,
            version: row.version,
          },
        );
        return row;
      });
      entityEventEmitter.emit('story_schema_field_changed', updated.storyId, updated.entityType);
    },

    async reorderFields(currentUserId, storyId, entityType, newOrder): Promise<void> {
      await assertStoryIsWritable(db, storyId);
      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      // Only the fields that moved are edited: each takes the rank of its new place.
      await runLocalWrite(db, storyId, () => {
        const orderedIds = [...newOrder]
          .sort((left, right) => left.order - right.order)
          .map((item) => item.id);
        const changes = planContainerOrderSync(
          db,
          'StorySchemaField',
          storyId,
          { entityType },
          orderedIds,
        );
        writeRankChangesSync(db, storyId, userIdToLog, 'StorySchemaField', changes);
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

      await runLocalWrite(db, field.storyId, () => {
        const updatedField = db
          .update(storySchemaFields)
          .set({
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
            version: sql`${storySchemaFields.version} + 1`,
          })
          .where(eq(storySchemaFields.id, fieldId))
          .returning({ id: storySchemaFields.id, version: storySchemaFields.version })
          .get();
        if (!updatedField) {
          throw new Error(`Failed to delete attribute field ${fieldId}.`);
        }
        recordLocalOperationSync(
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
      });

      // Values cannot outlive their field: their deletion and per-row sync operations belong to
      // AttributeValueService, which owns that entity's lifecycle.
      await createAttributeValueService(db).deleteValuesForField(
        currentUserId,
        field.storyId,
        fieldId,
      );

      entityEventEmitter.emit('story_schema_field_changed', field.storyId, field.entityType);
    },
  };
};

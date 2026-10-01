import type { AttributeType, StorySchemaEntityType } from '@keres/shared';
import { explodeAttributeUsageValue } from '@keres/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { AttributeValueInsert, AttributeValueSelect } from '../../db/schema';
import { attributeValues, storySchemaFields } from '../../db/schema';
import { prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface AttributeValueService {
  getValuesForEntity(entityId: string): Promise<AttributeValueSelect[]>;
  /**
   * It harvests values used by other entities of the same field, the same mechanism as
   * `SuggestionService.getSuggestions` (a count per value, sorted alphabetically) - only
   * against `attributeValues` instead of a fixed column, since custom fields have no
   * column of their own. See `SuggestionService`'s `custom:<fieldId>` branch, which calls this.
   */
  getValueUsageCounts(fieldId: string): Promise<[string, number][]>;
  /**
   * A batch upsert: it creates/updates one value per field, ignores fields with no value that did not
   * exist yet (it does not create an empty row for nothing).
   */
  saveValuesForEntity(
    currentUserId: string,
    storyId: string,
    entityType: StorySchemaEntityType,
    entityId: string,
    values: Record<string, string | null>,
  ): Promise<void>;
  /** Soft-deletes every live value of a removed custom field, with one sync operation per value. */
  deleteValuesForField(currentUserId: string, storyId: string, fieldId: string): Promise<number>;
}

export const createAttributeValueService = (db: AppDrizzleClient): AttributeValueService => {
  const serverService = createServerService(db);
  return {
    async getValuesForEntity(entityId: string): Promise<AttributeValueSelect[]> {
      return db
        .select()
        .from(attributeValues)
        .where(and(eq(attributeValues.entityId, entityId), eq(attributeValues.isDeleted, false)))
        .all();
    },

    async getValueUsageCounts(fieldId: string): Promise<[string, number][]> {
      const field = await db.query.storySchemaFields.findFirst({
        where: eq(storySchemaFields.id, fieldId),
        columns: { type: true },
      });
      const rows = await db
        .select({ value: attributeValues.value })
        .from(attributeValues)
        .where(
          and(
            eq(attributeValues.fieldId, fieldId),
            eq(attributeValues.isDeleted, false),
            sql`${attributeValues.value} IS NOT NULL AND ${attributeValues.value} != ''`,
          ),
        )
        .all();

      const counts = new Map<string, number>();
      for (const { value } of rows) {
        if (!value) continue;
        for (const item of explodeAttributeUsageValue(field?.type as AttributeType, value)) {
          counts.set(item, (counts.get(item) ?? 0) + 1);
        }
      }
      return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    },

    async saveValuesForEntity(currentUserId, storyId, entityType, entityId, values): Promise<void> {
      await assertStoryIsWritable(db, storyId);
      const fieldIds = Object.keys(values);
      if (fieldIds.length === 0) {
        return;
      }

      // Tombstones too: (entityId, fieldId) is unique across deleted rows, so a value set again
      // after its field's values were removed must revive the old row, not insert a second one.
      const rows = await db
        .select()
        .from(attributeValues)
        .where(eq(attributeValues.entityId, entityId))
        .all();
      const existingByFieldId = new Map(
        rows.filter((row) => !row.isDeleted).map((row) => [row.fieldId, row]),
      );
      const tombstoneByFieldId = new Map(
        rows.filter((row) => row.isDeleted).map((row) => [row.fieldId, row]),
      );

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);

      const changed = await runLocalWrite(db, storyId, () => {
        let anyChanged = false;
        for (const fieldId of fieldIds) {
          const rawValue = values[fieldId];
          const existing = existingByFieldId.get(fieldId);

          if (existing) {
            if (existing.value === rawValue) {
              continue;
            }
            const updated = db
              .update(attributeValues)
              .set({
                value: rawValue,
                updatedAt: new Date(),
                version: sql`${attributeValues.version} + 1`,
              })
              .where(eq(attributeValues.id, existing.id))
              .returning({ id: attributeValues.id, version: attributeValues.version })
              .get();
            if (!updated) {
              continue;
            }
            recordLocalOperationSync(
              db,
              storyId,
              userIdToLog,
              'update',
              'AttributeValue',
              existing.id,
              {
                value: rawValue,
                version: updated.version,
              },
            );
            anyChanged = true;
          } else if (rawValue !== null && rawValue !== '') {
            const tombstone = tombstoneByFieldId.get(fieldId);
            if (tombstone) {
              const revived = db
                .update(attributeValues)
                .set({
                  value: rawValue,
                  isDeleted: false,
                  deletedAt: null,
                  updatedAt: new Date(),
                  version: sql`${attributeValues.version} + 1`,
                })
                .where(eq(attributeValues.id, tombstone.id))
                .returning({ id: attributeValues.id, version: attributeValues.version })
                .get();
              if (!revived) {
                continue;
              }
              // isDeleted: false on a deleted row is what the server applies as a restore.
              recordLocalOperationSync(
                db,
                storyId,
                userIdToLog,
                'update',
                'AttributeValue',
                tombstone.id,
                { value: rawValue, isDeleted: false, version: revived.version },
              );
              anyChanged = true;
              continue;
            }
            const newRow = prepareNewEntityData<AttributeValueInsert>({
              storyId,
              entityType,
              entityId,
              fieldId,
              value: rawValue,
            });
            const result = db.insert(attributeValues).values(newRow).returning().get();
            recordLocalOperationSync(
              db,
              storyId,
              userIdToLog,
              'create',
              'AttributeValue',
              newRow.id,
              { ...result },
            );
            anyChanged = true;
          }
        }
        return anyChanged;
      });

      if (changed) {
        entityEventEmitter.emit('attribute_value_changed', storyId, entityId);
      }
    },

    async deleteValuesForField(currentUserId, storyId, fieldId): Promise<number> {
      await assertStoryIsWritable(db, storyId);
      const values = await db
        .select({ id: attributeValues.id, entityId: attributeValues.entityId })
        .from(attributeValues)
        .where(
          and(
            eq(attributeValues.storyId, storyId),
            eq(attributeValues.fieldId, fieldId),
            eq(attributeValues.isDeleted, false),
          ),
        )
        .all();
      if (values.length === 0) return 0;

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      const now = new Date();
      const deletedEntityIds = await runLocalWrite(db, storyId, () => {
        const entityIds: string[] = [];
        for (const value of values) {
          const updated = db
            .update(attributeValues)
            .set({
              isDeleted: true,
              deletedAt: now,
              updatedAt: now,
              version: sql`${attributeValues.version} + 1`,
            })
            .where(eq(attributeValues.id, value.id))
            .returning({ id: attributeValues.id, version: attributeValues.version })
            .get();
          if (!updated) continue;
          recordLocalOperationSync(db, storyId, userIdToLog, 'delete', 'AttributeValue', value.id, {
            id: value.id,
            isDeleted: true,
            version: updated.version,
          });
          entityIds.push(value.entityId);
        }
        return entityIds;
      });
      for (const entityId of deletedEntityIds) {
        entityEventEmitter.emit('attribute_value_changed', storyId, entityId);
      }
      return values.length;
    },
  };
};

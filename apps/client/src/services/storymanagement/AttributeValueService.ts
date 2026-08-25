import type { AttributeType, StorySchemaEntityType } from '@keres/shared';
import { explodeAttributeUsageValue } from '@keres/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { AttributeValueInsert, AttributeValueSelect } from '../../db/schema';
import { attributeValues, storySchemaFields } from '../../db/schema';
import { prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { getUserIdForOperation, recordLocalOperation } from '../../utils/syncUtils';
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
      const fieldIds = Object.keys(values);
      if (fieldIds.length === 0) {
        return;
      }

      const existingRows = await db
        .select()
        .from(attributeValues)
        .where(and(eq(attributeValues.entityId, entityId), eq(attributeValues.isDeleted, false)))
        .all();
      const existingByFieldId = new Map(existingRows.map((row) => [row.fieldId, row]));

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      let changed = false;

      for (const fieldId of fieldIds) {
        const rawValue = values[fieldId];
        const existing = existingByFieldId.get(fieldId);

        if (existing) {
          if (existing.value === rawValue) {
            continue;
          }
          const [updated] = await db
            .update(attributeValues)
            .set({
              value: rawValue,
              updatedAt: new Date(),
              version: sql`${attributeValues.version} + 1`,
            })
            .where(eq(attributeValues.id, existing.id))
            .returning({ id: attributeValues.id, version: attributeValues.version });
          if (!updated) {
            continue;
          }
          await recordLocalOperation(
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
          changed = true;
        } else if (rawValue !== null && rawValue !== '') {
          const newRow = prepareNewEntityData<AttributeValueInsert>({
            storyId,
            entityType,
            entityId,
            fieldId,
            value: rawValue,
          });
          const result = await db.insert(attributeValues).values(newRow).returning().get();
          await recordLocalOperation(
            db,
            storyId,
            userIdToLog,
            'create',
            'AttributeValue',
            newRow.id,
            { ...result },
          );
          changed = true;
        }
      }

      if (changed) {
        entityEventEmitter.emit('attribute_value_changed', storyId, entityId);
      }
    },
  };
};

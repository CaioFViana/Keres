import { AttributeType } from '@keres/shared';
import type { SQL } from 'drizzle-orm';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import { attributeValues, storySchemaFields } from '../db/schema';
import { extractCustomFieldId } from './customAttributeFieldMetadata';

/**
 * Builds the WHERE condition for an advanced search criterion key that references a custom attribute
 * (`custom:<fieldId>`) - the same shape as the subquery already used for tag filtering in each service
 * (`inArray(entity.id, db.select(...).from(...))`), only against the EAV table `attributeValues`
 * instead of a fixed relation.
 *
 * It returns `null` if `key` is not a custom attribute criterion, or if the referenced field no longer
 * exists - the caller simply ignores the condition in those cases, the same treatment a missing
 * `fieldMetadata` already gets today.
 *
 * Number/boolean never compare `attributeValues.value`'s raw text against the typed value received from
 * the search form - always through the same encoding as `encodeAttributeValue` (implicit here through
 * `String(Number(...))`/`'true'|'false'`); the reason is documented in
 * `packages/shared/utils/attributeValueCodec.ts`.
 */
export async function buildCustomAttributeSearchCondition(
  db: AppDrizzleClient,
  entityIdColumn: any,
  key: string,
  rawValue: any,
): Promise<SQL<boolean> | null> {
  const fieldId = extractCustomFieldId(key);
  if (!fieldId) {
    return null;
  }

  const field = await db.query.storySchemaFields.findFirst({
    where: and(eq(storySchemaFields.id, fieldId), eq(storySchemaFields.isDeleted, false)),
  });
  if (!field) {
    return null;
  }

  let valuePredicate: SQL<boolean>;
  switch (field.type as AttributeType) {
    case AttributeType.NUMBER: {
      const numeric = Number(rawValue);
      if (!Number.isFinite(numeric)) {
        return null;
      }
      valuePredicate = eq(attributeValues.value, String(numeric)) as SQL<boolean>;
      break;
    }
    case AttributeType.BOOLEAN:
      valuePredicate = eq(
        attributeValues.value,
        rawValue === true || rawValue === 'true' ? 'true' : 'false',
      ) as SQL<boolean>;
      break;
    case AttributeType.ENTITY:
      valuePredicate = eq(attributeValues.value, String(rawValue)) as SQL<boolean>;
      break;
    default:
      // text, long_text, date, suggestion - substring match, same treatment native string/date
      // fields already get.
      valuePredicate =
        sql`${attributeValues.value} LIKE ${`%${rawValue}%`} COLLATE NOCASE` as SQL<boolean>;
      break;
  }

  const matchingEntityIds = db
    .select({ entityId: attributeValues.entityId })
    .from(attributeValues)
    .where(
      and(
        eq(attributeValues.fieldId, fieldId),
        eq(attributeValues.isDeleted, false),
        valuePredicate,
      ),
    );

  return inArray(entityIdColumn, matchingEntityIds) as SQL<boolean>;
}

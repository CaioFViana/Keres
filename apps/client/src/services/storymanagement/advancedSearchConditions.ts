import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { eq, sql, type SQL } from 'drizzle-orm';

/** Builds predicates for handler-declared native search fields; joins remain in their own services. */
export function buildNativeAdvancedSearchConditions(
  entityType: string,
  table: object,
  criteria: Record<string, unknown> | undefined,
): SQL<boolean>[] {
  if (!criteria) return [];
  const metadata = entityFieldMetadata[entityType] ?? [];
  const conditions: SQL<boolean>[] = [];
  for (const [field, value] of Object.entries(criteria)) {
    if (value === undefined || value === null || value === '') continue;
    const meta = metadata.find((candidate) => candidate.name === field);
    const column = (table as any)[field];
    if (!meta || !column) continue;
    if (meta.type === 'string' || meta.type === 'id' || meta.type === 'date') {
      conditions.push(sql`${column} LIKE ${`%${value}%`} COLLATE NOCASE` as SQL<boolean>);
    } else if (meta.type === 'number') {
      conditions.push(eq(column, Number(value)) as SQL<boolean>);
    } else if (meta.type === 'boolean') {
      conditions.push(
        eq(column, value === 'true' ? true : value === 'false' ? false : value) as SQL<boolean>,
      );
    } else {
      conditions.push(eq(column, value) as SQL<boolean>);
    }
  }
  return conditions;
}

/** Adds entity-specific fallback predicates, normally custom-attribute searches. */
export async function buildAdvancedSearchConditions(
  entityType: string,
  table: object,
  criteria: Record<string, unknown> | undefined,
  onUnknown?: (field: string, value: unknown) => Promise<SQL<boolean> | null | undefined>,
): Promise<SQL<boolean>[]> {
  const conditions = buildNativeAdvancedSearchConditions(entityType, table, criteria);
  if (!criteria || !onUnknown) return conditions;
  const known = new Set((entityFieldMetadata[entityType] ?? []).map((field) => field.name));
  for (const [field, value] of Object.entries(criteria)) {
    if (known.has(field) || value === undefined || value === null || value === '') continue;
    const condition = await onUnknown(field, value);
    if (condition) conditions.push(condition);
  }
  return conditions;
}

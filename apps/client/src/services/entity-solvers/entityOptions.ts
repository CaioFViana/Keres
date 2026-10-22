import type { GlobalSearchEntityType } from '@keres/shared/metadata/globalSearchFields';
import { globalSearchFieldConfig } from '@keres/shared/metadata/globalSearchFields';
import { and, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '@/src/db';
import { columnsOf, getEntityTable } from '@/src/db/entityTableRegistry';

export interface EntityOption {
  id: string;
  name: string;
}

/**
 * Loads the live entities of one type that can be selected by an entity
 * reference. The table and its display column intentionally come from the
 * same registries used by global search, keeping name/title selection aligned.
 */
export async function loadEntityOptions(
  db: AppDrizzleClient,
  storyId: string,
  entityType: GlobalSearchEntityType,
): Promise<EntityOption[]> {
  const table = getEntityTable(entityType);
  const config = globalSearchFieldConfig[entityType];
  if (!table || !config) {
    return [];
  }

  const columns = columnsOf(table);
  const rows = (await db
    .select({ id: columns.id, name: columns[config.titleField] })
    .from(table)
    .where(and(eq(columns.storyId, storyId), eq(columns.isDeleted, false)))
    .all()) as { id: string; name: string | null }[];

  return rows.map((row) => ({ id: row.id, name: row.name ?? '' }));
}

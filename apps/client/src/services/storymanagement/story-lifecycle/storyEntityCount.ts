import { and, count, eq, type SQL } from 'drizzle-orm';
import type { AppDrizzleClient } from '@/src/db';
import { stories } from '@/src/db/schema';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { columnsOf } from '@/src/db/entityTableRegistry';

/** Counts live entity rows owned by a live story, optionally with entity-specific constraints. */
export async function countActiveStoryEntities(
  db: AppDrizzleClient,
  table: SQLiteTable,
  storyId?: string,
  extraConditions: SQL<boolean>[] = [],
): Promise<number> {
  const columns = columnsOf(table);
  const conditions = [
    eq(stories.isDeleted, false),
    eq(columns.isDeleted, false),
    ...extraConditions,
  ];
  if (storyId) conditions.push(eq(columns.storyId, storyId));
  const result = await db
    .select({ count: count() })
    .from(table)
    .innerJoin(stories, eq(columns.storyId, stories.id))
    .where(and(...conditions))
    .get();
  return result?.count ?? 0;
}

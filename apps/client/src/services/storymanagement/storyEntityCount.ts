import { and, count, eq, type SQL } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import { stories } from '../../db/schema';

/** Counts live entity rows owned by a live story, optionally with entity-specific constraints. */
export async function countActiveStoryEntities(
  db: AppDrizzleClient,
  table: any,
  storyId?: string,
  extraConditions: SQL<boolean>[] = [],
): Promise<number> {
  const conditions = [eq(stories.isDeleted, false), eq(table.isDeleted, false), ...extraConditions];
  if (storyId) conditions.push(eq(table.storyId, storyId));
  const result = await db
    .select({ count: count() })
    .from(table)
    .innerJoin(stories, eq(table.storyId, stories.id))
    .where(and(...conditions))
    .get();
  return result?.count ?? 0;
}

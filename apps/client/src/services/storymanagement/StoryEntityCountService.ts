import { getTierCountedEntityTypes, getTierRelationalEntityTypes } from '@keres/shared';
import { and, count, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import { getEntityTable } from '../entityTableRegistry';

export interface StoryEntityCounts {
  /** The sum of `byType`. */
  total: number;
  /** Live rows per entity type, only the types with at least one. */
  byType: Partial<Record<string, number>>;
}

/**
 * Live rows of a story per entity type, for the given types. The table is chosen at runtime, as in
 * `loadEntityOptions`: every type asked for has `storyId` and `isDeleted` (the test checks it).
 */
async function countTypes(
  db: AppDrizzleClient,
  storyId: string,
  entityTypes: readonly string[],
): Promise<StoryEntityCounts> {
  const entries = await Promise.all(
    entityTypes.map(async (entityType) => {
      const table = getEntityTable(entityType) as any;
      if (!table) return [entityType, 0] as const;
      const [row] = (await db
        .select({ value: count() })
        .from(table)
        .where(and(eq(table.storyId, storyId), eq(table.isDeleted, false)))) as {
        value: number;
      }[];
      return [entityType, row?.value ?? 0] as const;
    }),
  );

  const byType: Partial<Record<string, number>> = {};
  let total = 0;
  for (const [entityType, value] of entries) {
    if (value > 0) byType[entityType] = value;
    total += value;
  }
  return { total, byType };
}

/**
 * How many entities a story has, counted as the server counts them for the plan (`maxEntitiesPerStory`):
 * one per live row of each type `getTierCountedEntityTypes` names - what the writer creates. The story
 * itself, favorites and comments are left out, and so are the rows that only link or fill in other entities
 * (relations, custom field and stat values). The list of types comes from the same shared rule the API
 * enforces, so a type added later is counted here the day it is counted there.
 *
 * Only information: nothing here blocks anything.
 */
export const createStoryEntityCountService = (db: AppDrizzleClient) => ({
  countForStory(storyId: string): Promise<StoryEntityCounts> {
    return countTypes(db, storyId, getTierCountedEntityTypes());
  },

  /**
   * The links and values the plan does not count, for the screen to show apart. Counts toward no plan
   * and no limit: it is only a look at how connected the story is.
   */
  countRelationsForStory(storyId: string): Promise<StoryEntityCounts> {
    return countTypes(db, storyId, getTierRelationalEntityTypes());
  },
});

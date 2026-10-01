import { getTierCountedEntityTypes } from '@keres/shared';
import { and, count, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import { getEntityTable } from '../entityTableRegistry';

export interface StoryEntityCounts {
  /** What the plan's entity ceiling sees for this story: the sum of `byType`. */
  total: number;
  /** Live rows per entity type, only the types with at least one. */
  byType: Partial<Record<string, number>>;
}

/**
 * How many entities a story has, counted as the server counts them for the plan (`maxEntitiesPerStory`):
 * one per live row of every synchronized entity type, relations and links included, minus the types
 * `TIER_EXEMPT_ENTITY_TYPES` leaves out. The list of types comes from the same shared rule the API
 * enforces, so a type added later is counted here the day it is counted there.
 *
 * Only information: nothing here blocks anything.
 */
export const createStoryEntityCountService = (db: AppDrizzleClient) => ({
  async countForStory(storyId: string): Promise<StoryEntityCounts> {
    const entries = await Promise.all(
      getTierCountedEntityTypes().map(async (entityType) => {
        // Same registry-driven access as `loadEntityOptions`: the table is chosen at runtime, and every
        // one of the types counted has `storyId` and `isDeleted` (the test checks it).
        const table = getEntityTable(entityType) as any;
        if (!table) return [entityType, 0] as const;
        const [row] = (await db
          .select({ value: count() })
          .from(table)
          .where(and(eq(table.storyId, storyId), eq(table.isDeleted, false)))) as { value: number }[];
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
  },
});

import type { FullStoryExportType } from '@keres/shared';
import {
  CURRENT_STORY_FORMAT_VERSION,
  FullStoryExportSchema,
  getStoryExportCollections,
  OperationLogEntityType,
  pruneDanglingStoryExportRows,
} from '@keres/shared';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { getApiEntityTable } from '../entity-solvers/ApiEntityTableRegistry';

/**
 * Database read adapter for portable-story export. Shared handlers define which collections are
 * in a package; this file reads those host tables, applies the user-scoped favourite visibility
 * rule, and validates the assembled package before it leaves the API.
 */
export class DatabaseStoryPackageExporter {
  async exportStory(storyId: string, userId?: string): Promise<FullStoryExportType> {
    const story = await db.query.stories.findFirst({
      where: eq(schema.stories.id, storyId),
    });
    if (!story) {
      throw new Error(`Story with ID ${storyId} not found.`);
    }

    const collectionRows = await Promise.all(
      getStoryExportCollections()
        .filter(({ entityType }) => entityType !== OperationLogEntityType.Favorite)
        .map(async ({ entityType, collection }) => {
          const table = getApiEntityTable(entityType);
          if (!table?.storyId || !table.isDeleted) {
            throw new Error(`No portable database table configured for ${entityType}.`);
          }
          const rows = await db
            .select()
            .from(table)
            .where(and(eq(table.storyId, storyId), eq(table.isDeleted, false)));
          return [collection, rows] as const;
        }),
    );

    const favorites = userId
      ? await db.query.favorites.findMany({
          where: and(
            eq(schema.favorites.storyId, storyId),
            ...(story.favoriteBehavior === 'individual_public'
              ? []
              : [eq(schema.favorites.userId, userId)]),
            eq(schema.favorites.isDeleted, false),
          ),
        })
      : [];

    const [latestOperation] = await db
      .select({
        version: sql<number>`max(${schema.operationLog.operationVersion})`.as('maxVersion'),
      })
      .from(schema.operationLog)
      .where(eq(schema.operationLog.storyId, storyId));

    const portable = {
      story,
      ...Object.fromEntries(collectionRows),
      favorites,
      serverLastOperationVersion: latestOperation?.version || 1,
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
      // The collection keys are verified by `getStoryExportCollections` tests, but TypeScript
      // cannot infer literal keys through Object.fromEntries. Zod below remains the runtime guard.
    } as unknown as FullStoryExportType;

    return FullStoryExportSchema.parse(pruneDanglingStoryExportRows(portable));
  }
}

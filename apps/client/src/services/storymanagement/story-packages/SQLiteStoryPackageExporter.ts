import {
  CURRENT_STORY_FORMAT_VERSION,
  FullStoryExportSchema,
  getStoryExportCollections,
  pruneDanglingStoryExportRows,
  type FullStoryExportType,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../../db';
import { stories } from '../../../db/schema';
import { getEntityTable } from '../../entityTableRegistry';

/**
 * SQLite read adapter for portable story packages. Shared entity handlers declare every collection
 * in the package; this adapter reads their local tables, removes dangling references to soft-deleted
 * rows, and validates the result before it leaves the device.
 */
export class SQLiteStoryPackageExporter {
  constructor(private readonly db: AppDrizzleClient) {}

  async exportStory(storyId: string): Promise<FullStoryExportType> {
    const story = await this.db.select().from(stories).where(eq(stories.id, storyId)).get();
    if (!story) {
      throw new Error(`Story with ID ${storyId} not found for export.`);
    }

    const collectionRows = await Promise.all(
      getStoryExportCollections().map(async ({ entityType, collection }) => {
        const table = getEntityTable(entityType);
        if (!table || !('storyId' in table) || !('isDeleted' in table)) {
          throw new Error(`No portable SQLite table configured for ${entityType}.`);
        }
        const rows = await this.db
          .select()
          .from(table as any)
          .where(and(eq((table as any).storyId, storyId), eq((table as any).isDeleted, false)));
        return [collection, rows] as const;
      }),
    );

    const portable = {
      story,
      ...Object.fromEntries(collectionRows),
      serverLastOperationVersion: story.lastServerSyncedLog || 0,
      formatVersion: CURRENT_STORY_FORMAT_VERSION,
    } as unknown as FullStoryExportType;

    return FullStoryExportSchema.parse(pruneDanglingStoryExportRows(portable));
  }
}

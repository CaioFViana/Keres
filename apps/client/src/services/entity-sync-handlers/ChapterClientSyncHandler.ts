import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import type { Chapter } from '@keres/shared/entities/narrative/Chapter'; // Import the Chapter entity interface
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '@/src/db';
import * as schema from '@/src/db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';
import { logger } from '@/src/utils/logging/logger';

export class ChapterClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Chapter';
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;

  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient | AppDrizzleTransaction {
    if (!this.dbInstance) {
      throw new Error('ChapterClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(update: CreateStoryUpdate, storyId: string): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      logger.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const chapterData = update.data as Chapter;

    await this.db.insert(schema.chapters).values({
      ...chapterData,
      id: update.id,
      storyId: storyId,
      createdAt: new Date(chapterData.createdAt),
      updatedAt: new Date(chapterData.updatedAt),
      deletedAt: chapterData.deletedAt ? new Date(chapterData.deletedAt) : null,
    });
    logger.debug(`Applied create for Chapter ${update.id} in story ${storyId}`);
  }

  async applyUpdate(update: UpdateStoryUpdate, storyId: string): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      logger.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const chapterChanges = update.changes as Partial<Chapter>;

    await this.db
      .update(schema.chapters)
      .set({
        ...chapterChanges,
        storyId: storyId, // Ensure storyId is set for the update context
        updatedAt: new Date(), // Always update updatedAt on change
        // Ensure date fields are correctly converted if they come as strings
        createdAt: chapterChanges.createdAt ? new Date(chapterChanges.createdAt) : undefined,
        deletedAt: chapterChanges.deletedAt ? new Date(chapterChanges.deletedAt) : undefined,
      })
      .where(eq(schema.chapters.id, update.id));
    logger.debug(`Applied update for Chapter ${update.id}`);
  }

  async applyDelete(update: DeleteStoryUpdate, storyId: string): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      logger.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
      return;
    }

    await this.db
      .update(schema.chapters)
      .set({
        storyId: storyId,
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.chapters.id, update.id));
    logger.debug(`Applied delete for Chapter ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<Chapter | undefined> {
    const chapter = await this.db.query.chapters.findFirst({
      where: eq(schema.chapters.id, id),
    });
    return chapter;
  }
}

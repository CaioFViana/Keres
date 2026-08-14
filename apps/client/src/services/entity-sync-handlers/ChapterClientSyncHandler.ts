import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { Chapter } from '@keres/shared/entities/Chapter'; // Import the Chapter entity interface
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class ChapterClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Chapter';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('ChapterClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
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
    console.log(`Applied create for Chapter ${update.id} in story ${storyId}`);
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
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
    console.log(`Applied update for Chapter ${update.id}`);
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
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
    console.log(`Applied delete for Chapter ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<Chapter | undefined> {
    const chapter = await this.db.query.chapters.findFirst({
      where: eq(schema.chapters.id, id),
    });
    return chapter;
  }
}

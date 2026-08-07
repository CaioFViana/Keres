import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { Tag } from '@keres/shared/entities/Tag'; // Import the Tag entity interface
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class TagClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Tag';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('TagClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> { // ADDED storyId parameter
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const tagData = update.data as Tag;

    await this.db.insert(schema.tags).values({
      ...tagData,
      id: update.id,
      storyId: storyId,
      createdAt: new Date(tagData.createdAt),
      updatedAt: new Date(tagData.updatedAt),
      deletedAt: tagData.deletedAt ? new Date(tagData.deletedAt) : null,
    });
    console.log(`Applied create for Tag ${update.id} in story ${storyId}`);
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> { // ADDED storyId parameter
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const tagChanges = update.changes as Partial<Tag>;

    await this.db.update(schema.tags)
      .set({
        ...tagChanges,
        updatedAt: new Date(), // Always update updatedAt on change
        // Ensure date fields are correctly converted if they come as strings
        createdAt: tagChanges.createdAt ? new Date(tagChanges.createdAt) : undefined,
        deletedAt: tagChanges.deletedAt ? new Date(tagChanges.deletedAt) : undefined,
      })
      .where(eq(schema.tags.id, update.id));
    console.log(`Applied update for Tag ${update.id} in story ${storyId}`); // ADDED storyId to log
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> { // ADDED storyId parameter
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    await this.db.update(schema.tags)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.tags.id, update.id));
    console.log(`Applied delete for Tag ${update.id} in story ${storyId}`); // ADDED storyId to log
  }

  async getById(id: string): Promise<Tag | undefined> {
    const tag = await this.db.query.tags.findFirst({
      where: eq(schema.tags.id, id),
    });
    return tag;
  }
}
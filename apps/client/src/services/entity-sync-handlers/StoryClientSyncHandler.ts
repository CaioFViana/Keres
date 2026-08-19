import { CreateStoryUpdate, DeleteStoryUpdate, Story, UpdateStoryUpdate } from '@keres/shared'; // Assuming Story entity is shared
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { omitClientProtectedFields, toEntityColumns } from '../entityTableRegistry';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class StoryClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Story';
  private dbInstance: AppDrizzleClient | null = null; // Use a private property for the db instance

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('StoryClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    // Ensure the ID is available for a create operation
    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const storyData = omitClientProtectedFields(this.entityName, update.data as Story);

    await this.db.insert(schema.stories).values({
      ...toEntityColumns(this.entityName, storyData),
      id: update.id,
      userId: update.originatingUser || (update.data as Story)?.userId,
      title: storyData.title,
      type: storyData.type,
      createdAt: new Date(storyData.createdAt),
      updatedAt: new Date(storyData.updatedAt),
      deletedAt: storyData.deletedAt ? new Date(storyData.deletedAt) : null,
      version: storyData.version ?? 1,
      isDeleted: storyData.isDeleted ?? false,
      lastOperationLog: 0,
      lastServerSyncedLog: 0,
      lastPublicFavoriteLog: 0,
      myRole: null,
      serverId: null,
    });
    console.log(`Applied create for Story ${update.id}`);
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    // Ensure ID and changes are available
    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    // Assuming update.changes contains partial story object with updated fields
    const storyChanges = toEntityColumns(
      this.entityName,
      omitClientProtectedFields(this.entityName, update.changes as Partial<Story>),
    );

    await this.db
      .update(schema.stories)
      .set({
        ...storyChanges,
        updatedAt: new Date(),
      })
      .where(eq(schema.stories.id, update.id));
    console.log(`Applied update for Story ${update.id}`);
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    // Ensure ID is available
    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    // Mark the story as deleted locally (tombstone pattern)
    await this.db
      .update(schema.stories)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.stories.id, update.id));
    console.log(`Applied delete for Story ${update.id}`);
  }

  async getById(id: string): Promise<Story | undefined> {
    const story = await this.db.query.stories.findFirst({
      where: eq(schema.stories.id, id),
    });
    return story;
  }
}

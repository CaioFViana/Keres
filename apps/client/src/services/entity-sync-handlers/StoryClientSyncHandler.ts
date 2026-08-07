import { CreateStoryUpdate, DeleteStoryUpdate, Story, UpdateStoryUpdate } from '@keres/shared'; // Assuming Story entity is shared
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
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

    // Assuming update.data contains the full story object
    const storyData = update.data as Story;

    // Create the story locally
    await this.db.insert(schema.stories).values({
      ...storyData,
      id: update.id, // Use the ID from the update object
      createdAt: new Date(storyData.createdAt),
      updatedAt: new Date(storyData.updatedAt),
      deletedAt: storyData.deletedAt ? new Date(storyData.deletedAt) : null,
      lastServerSyncedLog: 0 // Initialize to 0 for newly created client-side story
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
    const storyChanges = update.changes as Partial<Story>;

    await this.db.update(schema.stories)
      .set({
        ...storyChanges,
        updatedAt: new Date(), // Always update updatedAt on change
        // Ensure date fields are correctly converted if they come as strings
        createdAt: storyChanges.createdAt ? new Date(storyChanges.createdAt) : undefined,
        deletedAt: storyChanges.deletedAt ? new Date(storyChanges.deletedAt) : undefined,
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
    await this.db.update(schema.stories)
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

import type { CreateStoryUpdate, DeleteStoryUpdate, Story, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import * as schema from '../../db/schema';
import { omitClientProtectedFields, toEntityColumns } from '../entityTableRegistry';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class StoryClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Story';
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;

  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient | AppDrizzleTransaction {
    if (!this.dbInstance) {
      throw new Error('StoryClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

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
      // A remotely created story arrives without local sync state; cursors start at zero and
      // the role/server link is resolved later by the engine, never trusted from the payload.
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

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    // `changes` carries a partial entity; keys outside the table are dropped by `toEntityColumns`.
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
    // `stat_notation` is a text column in the local SQLite (the dialect has no ENUM), so the
    // inferred type is `string`; the union comes from the shared entity.
    return story as Story | undefined;
  }
}

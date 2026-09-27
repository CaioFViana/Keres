import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  StorySchemaField,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class StorySchemaFieldClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'StorySchemaField';
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;

  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient | AppDrizzleTransaction {
    if (!this.dbInstance) {
      throw new Error('StorySchemaFieldClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const fieldData = update.data as StorySchemaField;

    await this.db.insert(schema.storySchemaFields).values({
      ...fieldData,
      id: update.id,
      storyId,
      createdAt: new Date(fieldData.createdAt),
      updatedAt: new Date(fieldData.updatedAt),
      deletedAt: fieldData.deletedAt ? new Date(fieldData.deletedAt) : null,
    });
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const fieldChanges = { ...(update.changes as Partial<StorySchemaField>) };
    // These values define how existing AttributeValues are interpreted. Match
    // the API invariant even if an old or tampered operation reaches a client.
    delete fieldChanges.entityType;
    delete fieldChanges.key;
    delete fieldChanges.type;
    delete fieldChanges.targetEntityType;

    await this.db
      .update(schema.storySchemaFields)
      .set({
        ...fieldChanges,
        updatedAt: new Date(),
        createdAt: fieldChanges.createdAt ? new Date(fieldChanges.createdAt) : undefined,
        deletedAt: fieldChanges.deletedAt ? new Date(fieldChanges.deletedAt) : undefined,
      })
      .where(eq(schema.storySchemaFields.id, update.id));
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    const existing = await this.db.query.storySchemaFields.findFirst({
      where: eq(schema.storySchemaFields.id, update.id),
    });
    if (!existing || existing.isDeleted) {
      // It does not exist locally yet (an out-of-order pull) or has already been applied - idempotent.
      return;
    }

    // The key stays: uniqueness holds among live fields only, so a tombstone never blocks a new
    // field of its key, and the row matches the server's.
    await this.db
      .update(schema.storySchemaFields)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.storySchemaFields.id, update.id));
  }

  async getById(id: string): Promise<StorySchemaField | undefined> {
    const row = await this.db.query.storySchemaFields.findFirst({
      where: eq(schema.storySchemaFields.id, id),
    });
    return row as StorySchemaField | undefined;
  }
}

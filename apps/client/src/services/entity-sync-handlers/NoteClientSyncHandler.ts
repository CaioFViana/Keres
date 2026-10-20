import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import type { Note } from '@keres/shared/entities/narrative/Note'; // Import the Note entity interface
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '@/src/db';
import * as schema from '@/src/db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';
import { logger } from '@/src/utils/logging/logger';

export class NoteClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Note';
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;

  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient | AppDrizzleTransaction {
    if (!this.dbInstance) {
      throw new Error('NoteClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(update: CreateStoryUpdate, storyId: string): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      logger.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const noteData = update.data as Note;

    await this.db.insert(schema.notes).values({
      ...noteData,
      id: update.id,
      storyId: storyId,
      createdAt: new Date(noteData.createdAt),
      updatedAt: new Date(noteData.updatedAt),
      deletedAt: noteData.deletedAt ? new Date(noteData.deletedAt) : null,
    });
    logger.debug(`Applied create for Note ${update.id} in story ${storyId}`);
  }

  async applyUpdate(update: UpdateStoryUpdate, storyId: string): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      logger.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const noteChanges = update.changes as Partial<Note>;

    await this.db
      .update(schema.notes)
      .set({
        ...noteChanges,
        storyId: storyId,
        updatedAt: new Date(), // Always update updatedAt on change
        // Ensure date fields are correctly converted if they come as strings
        createdAt: noteChanges.createdAt ? new Date(noteChanges.createdAt) : undefined,
        deletedAt: noteChanges.deletedAt ? new Date(noteChanges.deletedAt) : undefined,
      })
      .where(eq(schema.notes.id, update.id));
    logger.debug(`Applied update for Note ${update.id}`);
  }

  async applyDelete(update: DeleteStoryUpdate, storyId: string): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      logger.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
      return;
    }

    await this.db
      .update(schema.notes)
      .set({
        storyId: storyId,
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.notes.id, update.id));
    logger.debug(`Applied delete for Note ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<Note | undefined> {
    const note = await this.db.query.notes.findFirst({
      where: eq(schema.notes.id, id),
    });
    return note;
  }
}

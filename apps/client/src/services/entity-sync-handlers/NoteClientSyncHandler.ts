import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { Note } from '@keres/shared/entities/Note'; // Import the Note entity interface
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class NoteClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Note';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('NoteClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
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
    console.log(`Applied create for Note ${update.id} in story ${storyId}`);
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
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
    console.log(`Applied update for Note ${update.id}`);
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
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
    console.log(`Applied delete for Note ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<Note | undefined> {
    const note = await this.db.query.notes.findFirst({
      where: eq(schema.notes.id, id),
    });
    return note;
  }
}

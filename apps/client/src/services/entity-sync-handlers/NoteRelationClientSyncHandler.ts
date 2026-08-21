import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { NoteRelation } from '@keres/shared/entities/Note';
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class NoteRelationClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'NoteRelation';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('NoteRelationClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const noteRelationData = update.data as NoteRelation;

    await this.db.insert(schema.noteRelations).values({
      ...noteRelationData,
      id: update.id,
      storyId: storyId,
      createdAt: new Date(noteRelationData.createdAt),
      updatedAt: new Date(noteRelationData.updatedAt),
      deletedAt: noteRelationData.deletedAt ? new Date(noteRelationData.deletedAt) : null,
    });
    console.log(`Applied create for NoteRelation ${update.id} in story ${storyId}`);
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const noteRelationChanges = update.changes as Partial<NoteRelation>;

    await this.db
      .update(schema.noteRelations)
      .set({
        ...noteRelationChanges,
        storyId: storyId,
        updatedAt: new Date(),
        createdAt: noteRelationChanges.createdAt
          ? new Date(noteRelationChanges.createdAt)
          : undefined,
        deletedAt: noteRelationChanges.deletedAt
          ? new Date(noteRelationChanges.deletedAt)
          : undefined,
      })
      .where(eq(schema.noteRelations.id, update.id));
    console.log(`Applied update for NoteRelation ${update.id}`);
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
      return;
    }

    await this.db
      .update(schema.noteRelations)
      .set({
        storyId: storyId,
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.noteRelations.id, update.id));
    console.log(`Applied delete for NoteRelation ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<NoteRelation | undefined> {
    const noteRelation = await this.db.query.noteRelations.findFirst({
      where: eq(schema.noteRelations.id, id),
    });
    return noteRelation;
  }
}

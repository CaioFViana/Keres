import type { CreateStoryUpdate, DeleteStoryUpdate, Song, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class SongClientSyncHandler implements ClientSyncEntityHandler {
  entityName = 'Song';
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;
  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction) {
    this.dbInstance = dbInstance;
  }
  private get db() {
    if (!this.dbInstance) throw new Error('SongClientSyncHandler: Drizzle client (db) not set.');
    return this.dbInstance;
  }
  async applyCreate(_: string, update: CreateStoryUpdate) {
    if (update.entity !== this.entityName || !update.id) return;
    const data = update.data as Song;
    await this.db.insert(schema.songs).values({
      ...data,
      id: update.id,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
    });
  }
  async applyUpdate(_: string, update: UpdateStoryUpdate) {
    if (update.entity !== this.entityName || !update.id || !update.changes) return;
    const changes = update.changes as Partial<Song>;
    await this.db
      .update(schema.songs)
      .set({
        ...changes,
        updatedAt: new Date(),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.songs.id, update.id));
  }
  async applyDelete(_: string, update: DeleteStoryUpdate) {
    if (update.entity !== this.entityName || !update.id) return;
    await this.db
      .update(schema.songs)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.songs.id, update.id));
  }
  async getById(id: string): Promise<Song | undefined> {
    return this.db.query.songs.findFirst({ where: eq(schema.songs.id, id) });
  }
}

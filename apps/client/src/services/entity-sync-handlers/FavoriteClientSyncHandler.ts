import { Favorite, CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import { favorites } from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class FavoriteClientSyncHandler implements ClientSyncEntityHandler {
  entityName = 'Favorite';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(db: AppDrizzleClient): void {
    this.dbInstance = db;
  }
  private get db(): AppDrizzleClient {
    if (!this.dbInstance) throw new Error('FavoriteClientSyncHandler: database not set.');
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    const data = update.data as Favorite;
    await this.db
      .insert(favorites)
      .values({
        ...data,
        id: update.id!,
        storyId,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
      })
      .onConflictDoNothing()
      .run();
  }

  async applyUpdate(_storyId: string, update: UpdateStoryUpdate): Promise<void> {
    const changes = update.changes as Partial<Favorite>;
    await this.db
      .update(favorites)
      .set({
        ...changes,
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        updatedAt: changes.updatedAt ? new Date(changes.updatedAt) : new Date(),
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : changes.deletedAt,
      })
      .where(eq(favorites.id, update.id!))
      .run();
  }

  async applyDelete(_storyId: string, update: DeleteStoryUpdate): Promise<void> {
    await this.db
      .update(favorites)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(favorites.id, update.id!))
      .run();
  }

  async getById(id: string): Promise<Favorite | undefined> {
    return (await this.db.query.favorites.findFirst({ where: eq(favorites.id, id) })) as
      | Favorite
      | undefined;
  }
}

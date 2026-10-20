import type {
  CharacterScene,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '@/src/db';
import * as schema from '@/src/db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';
import { logger } from '@/src/utils/logging/logger';

export class CharacterSceneClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'CharacterScene';
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;

  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient | AppDrizzleTransaction {
    if (!this.dbInstance) {
      throw new Error('CharacterSceneClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      logger.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const data = update.data as CharacterScene;

    await this.db.insert(schema.characterScenes).values({
      ...data,
      id: update.id,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
    });
    logger.debug(`Applied create for CharacterScene ${update.id}`);
  }

  async applyUpdate(update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      logger.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const changes = update.changes as Partial<CharacterScene>;

    await this.db
      .update(schema.characterScenes)
      .set({
        ...changes,
        updatedAt: new Date(),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.characterScenes.id, update.id));
    logger.debug(`Applied update for CharacterScene ${update.id}`);
  }

  async applyDelete(update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      logger.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    await this.db
      .update(schema.characterScenes)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.characterScenes.id, update.id));
    logger.debug(`Applied delete for CharacterScene ${update.id}`);
  }

  async getById(id: string): Promise<CharacterScene | undefined> {
    const entity = await this.db.query.characterScenes.findFirst({
      where: eq(schema.characterScenes.id, id),
    });
    return entity;
  }
}

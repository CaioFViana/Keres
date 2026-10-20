import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import type { CharacterRelation } from '@keres/shared/entities/narrative/CharacterRelation';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '@/src/db';
import * as schema from '@/src/db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';
import { logger } from '@/src/utils/logging/logger';

/**
 * Mirrors the server's character relations. The server refuses a second relation of one pair
 * (`duplicate`), and the device that made it folds its own row into the first: a relation
 * arriving here is one the server holds, never one to judge.
 */
export class CharacterRelationClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'CharacterRelation';
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;

  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient | AppDrizzleTransaction {
    if (!this.dbInstance) {
      throw new Error('CharacterRelationClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      logger.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const relationData = update.data as CharacterRelation;

    await this.db.insert(schema.characterRelations).values({
      ...relationData,
      id: update.id,
      storyId: storyId,
      createdAt: new Date(relationData.createdAt),
      updatedAt: new Date(relationData.updatedAt),
      deletedAt: relationData.deletedAt ? new Date(relationData.deletedAt) : null,
    });
    logger.debug(`Applied create for CharacterRelation ${update.id} in story ${storyId}`);
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      logger.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const localRelation = await this.db.query.characterRelations.findFirst({
      where: eq(schema.characterRelations.id, update.id),
    });

    if (!localRelation) {
      logger.warn(`CharacterRelation ${update.id} not found locally for update. Skipping.`);
      return;
    }

    const relationChanges = update.changes as Partial<CharacterRelation>;

    await this.db
      .update(schema.characterRelations)
      .set({
        ...relationChanges,
        storyId: storyId,
        updatedAt: new Date(update.operationTime || new Date()), // Use incoming updatedAt if present, else new Date
        // Ensure date fields are correctly converted if they come as strings
        createdAt: relationChanges.createdAt ? new Date(relationChanges.createdAt) : undefined,
        deletedAt: relationChanges.deletedAt ? new Date(relationChanges.deletedAt) : undefined,
      })
      .where(eq(schema.characterRelations.id, update.id));
    logger.debug(`Applied update for CharacterRelation ${update.id}`);
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      logger.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
      return;
    }

    await this.db
      .update(schema.characterRelations)
      .set({
        storyId: storyId,
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.characterRelations.id, update.id));
    logger.debug(`Applied delete for CharacterRelation ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<CharacterRelation | undefined> {
    const relation = await this.db.query.characterRelations.findFirst({
      where: eq(schema.characterRelations.id, id),
    });
    return relation;
  }
}

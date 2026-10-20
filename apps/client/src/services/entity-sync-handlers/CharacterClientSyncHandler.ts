import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import type { Character } from '@keres/shared/entities/narrative/Character'; // Import the Character entity interface
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '@/src/db';
import * as schema from '@/src/db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';
import { logger } from '@/src/utils/logging/logger';

export class CharacterClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Character';
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;

  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient | AppDrizzleTransaction {
    if (!this.dbInstance) {
      throw new Error('CharacterClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(update: CreateStoryUpdate, storyId: string): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      logger.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const characterData = update.data as Character;

    await this.db.insert(schema.characters).values({
      ...characterData,
      id: update.id,
      storyId: storyId,
      createdAt: new Date(characterData.createdAt),
      updatedAt: new Date(characterData.updatedAt),
      deletedAt: characterData.deletedAt ? new Date(characterData.deletedAt) : null,
    });
    logger.debug(`Applied create for Character ${update.id} in story ${storyId}`);
  }

  async applyUpdate(update: UpdateStoryUpdate, storyId: string): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      logger.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const characterChanges = update.changes as Partial<Character>;

    await this.db
      .update(schema.characters)
      .set({
        ...characterChanges,
        storyId: storyId,
        updatedAt: new Date(), // Always update updatedAt on change
        // Ensure date fields are correctly converted if they come as strings
        createdAt: characterChanges.createdAt ? new Date(characterChanges.createdAt) : undefined,
        deletedAt: characterChanges.deletedAt ? new Date(characterChanges.deletedAt) : undefined,
      })
      .where(eq(schema.characters.id, update.id));
    logger.debug(`Applied update for Character ${update.id}`);
  }

  async applyDelete(update: DeleteStoryUpdate, storyId: string): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      logger.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
      return;
    }

    await this.db
      .update(schema.characters)
      .set({
        storyId: storyId,
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.characters.id, update.id));
    logger.debug(`Applied delete for Character ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<Character | undefined> {
    const character = await this.db.query.characters.findFirst({
      where: eq(schema.characters.id, id),
    });
    return character;
  }
}

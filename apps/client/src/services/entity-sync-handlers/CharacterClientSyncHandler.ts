import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { Character } from '@keres/shared/entities/Character'; // Import the Character entity interface
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class CharacterClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Character';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('CharacterClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const characterData = update.data as Character;

    await this.db.insert(schema.characters).values({
      ...characterData,
      id: update.id,
      createdAt: new Date(characterData.createdAt),
      updatedAt: new Date(characterData.updatedAt),
      deletedAt: characterData.deletedAt ? new Date(characterData.deletedAt) : null,
    });
    console.log(`Applied create for Character ${update.id}`);
  }

  async applyUpdate(update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const characterChanges = update.changes as Partial<Character>;

    await this.db.update(schema.characters)
      .set({
        ...characterChanges,
        updatedAt: new Date(), // Always update updatedAt on change
        // Ensure date fields are correctly converted if they come as strings
        createdAt: characterChanges.createdAt ? new Date(characterChanges.createdAt) : undefined,
        deletedAt: characterChanges.deletedAt ? new Date(characterChanges.deletedAt) : undefined,
      })
      .where(eq(schema.characters.id, update.id));
    console.log(`Applied update for Character ${update.id}`);
  }

  async applyDelete(update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    await this.db.update(schema.characters)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.characters.id, update.id));
    console.log(`Applied delete for Character ${update.id}`);
  }

  async getById(id: string): Promise<Character | undefined> {
    const character = await this.db.query.characters.findFirst({
      where: eq(schema.characters.id, id),
    });
    return character;
  }
}

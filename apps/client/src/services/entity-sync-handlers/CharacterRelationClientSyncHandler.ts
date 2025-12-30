import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { CharacterRelation, ServerCharacterRelationPayload } from '@keres/shared/entities/CharacterRelation'; // Import the CharacterRelation entity interface
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class CharacterRelationClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'CharacterRelation';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('CharacterRelationClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const serverRelationData = update.data as ServerCharacterRelationPayload;
    const mappedRelationData: CharacterRelation = {
      ...serverRelationData,
      charId1: serverRelationData.character1Id,
      charId2: serverRelationData.character2Id,
    };
    // Remove server-specific fields after mapping
    delete (mappedRelationData as Partial<ServerCharacterRelationPayload>).character1Id;
    delete (mappedRelationData as Partial<ServerCharacterRelationPayload>).character2Id;

    await this.db.insert(schema.characterRelations).values({
      ...mappedRelationData,
      id: update.id,
      storyId: storyId,
      createdAt: new Date(mappedRelationData.createdAt),
      updatedAt: new Date(mappedRelationData.updatedAt),
      deletedAt: mappedRelationData.deletedAt ? new Date(mappedRelationData.deletedAt) : null,
    });
    console.log(`Applied create for CharacterRelation ${update.id} in story ${storyId}`);
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const serverRelationChanges = update.changes as Partial<ServerCharacterRelationPayload>;
    const mappedRelationChanges: Partial<CharacterRelation> = { ...serverRelationChanges };
    
    if (serverRelationChanges.character1Id !== undefined) {
      mappedRelationChanges.charId1 = serverRelationChanges.character1Id;
      delete (mappedRelationChanges as Partial<ServerCharacterRelationPayload>).character1Id;
    }
    if (serverRelationChanges.character2Id !== undefined) {
      mappedRelationChanges.charId2 = serverRelationChanges.character2Id;
      delete (mappedRelationChanges as Partial<ServerCharacterRelationPayload>).character2Id;
    }

    await this.db.update(schema.characterRelations)
      .set({
        ...mappedRelationChanges,
        storyId: storyId,
        updatedAt: new Date(), // Always update updatedAt on change
        // Ensure date fields are correctly converted if they come as strings
        createdAt: mappedRelationChanges.createdAt ? new Date(mappedRelationChanges.createdAt) : undefined,
        deletedAt: mappedRelationChanges.deletedAt ? new Date(mappedRelationChanges.deletedAt) : undefined,
      })
      .where(eq(schema.characterRelations.id, update.id));
    console.log(`Applied update for CharacterRelation ${update.id}`);
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
      return;
    }

    await this.db.update(schema.characterRelations)
      .set({
        storyId: storyId,
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.characterRelations.id, update.id));
    console.log(`Applied delete for CharacterRelation ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<CharacterRelation | undefined> {
    const relation = await this.db.query.characterRelations.findFirst({
      where: eq(schema.characterRelations.id, id),
    });
    return relation;
  }
}

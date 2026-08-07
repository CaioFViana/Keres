import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { CharacterRelation, ServerCharacterRelationPayload } from '@keres/shared/entities/CharacterRelation'; // Import the CharacterRelation entity interface
import { and, eq, or, sql } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

// Helper function to find an existing non-deleted relation for a given pair of characters
const getExistingRelationForPair = async (
  db: AppDrizzleClient,
  storyId: string,
  charIdA: string,
  charIdB: string,
  excludeRelationId?: string
): Promise<CharacterRelation | undefined> => {
  const conditions = [
    eq(schema.characterRelations.storyId, storyId),
    eq(schema.characterRelations.isDeleted, false),
    or(
      and(eq(schema.characterRelations.charId1, charIdA), eq(schema.characterRelations.charId2, charIdB)),
      and(eq(schema.characterRelations.charId1, charIdB), eq(schema.characterRelations.charId2, charIdA))
    )
  ];

  if (excludeRelationId) {
    conditions.push(sql`${schema.characterRelations.id} != ${excludeRelationId}`);
  }

  return db.query.characterRelations.findFirst({
    where: and(...conditions),
  });
};

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

    // Handle duplicate CharacterRelations during sync - applyCreate ---
    const existingDuplicate = await getExistingRelationForPair(
      this.db,
      storyId,
      mappedRelationData.charId1,
      mappedRelationData.charId2,
    );

    if (existingDuplicate) {
      // If the incoming data is newer, mark the existing one as deleted and apply the new one.
      // Otherwise, the existing one wins, and we discard the incoming create.
      if (mappedRelationData.updatedAt && existingDuplicate.updatedAt && new Date(mappedRelationData.updatedAt) > existingDuplicate.updatedAt) {
        console.log(`Sync conflict (create): Incoming CharacterRelation ${update.id} is newer than existing duplicate ${existingDuplicate.id}. Marking existing as deleted.`);
        await this.db.update(schema.characterRelations)
          .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: existingDuplicate.version + 1 })
          .where(eq(schema.characterRelations.id, existingDuplicate.id));
      } else {
        console.log(`Sync conflict (create): Existing CharacterRelation ${existingDuplicate.id} is newer or same as incoming ${update.id}. Discarding incoming create.`);
        return; // Discard the incoming create
      }
    }

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

    const localRelation = await this.db.query.characterRelations.findFirst({
      where: eq(schema.characterRelations.id, update.id),
    });

    if (!localRelation) {
      console.warn(`CharacterRelation ${update.id} not found locally for update. Skipping.`);
      return;
    }

    const serverRelationChanges = update.changes as Partial<ServerCharacterRelationPayload>;
    const mappedRelationChanges: Partial<CharacterRelation> = { ...serverRelationChanges };
    
    // Determine the effective charIds after this update, for duplicate checking
    const effectiveCharId1 = mappedRelationChanges.charId1 || serverRelationChanges.character1Id || localRelation.charId1;
    const effectiveCharId2 = mappedRelationChanges.charId2 || serverRelationChanges.character2Id || localRelation.charId2;
    
    // Remove server-specific fields after mapping
    if (serverRelationChanges.character1Id !== undefined) {
      mappedRelationChanges.charId1 = serverRelationChanges.character1Id;
      delete (mappedRelationChanges as Partial<ServerCharacterRelationPayload>).character1Id;
    }
    if (serverRelationChanges.character2Id !== undefined) {
      mappedRelationChanges.charId2 = serverRelationChanges.character2Id;
      delete (mappedRelationChanges as Partial<ServerCharacterRelationPayload>).character2Id;
    }

    // Handle duplicate CharacterRelations during sync - applyUpdate ---
    // Check if applying this update would create a duplicate with another *active* relation
    const existingDuplicate = await getExistingRelationForPair(
      this.db,
      storyId,
      effectiveCharId1,
      effectiveCharId2,
      update.id // Exclude the relation currently being updated
    );

    if (existingDuplicate) {
      // Assuming the incoming update carries an 'updatedAt' timestamp or we use current time
      const incomingUpdatedAt = mappedRelationChanges.updatedAt ? new Date(mappedRelationChanges.updatedAt) : new Date();

      if (incomingUpdatedAt > existingDuplicate.updatedAt) {
        console.log(`Sync conflict (update): Incoming CharacterRelation ${update.id} is newer than existing duplicate ${existingDuplicate.id}. Marking existing as deleted.`);
        await this.db.update(schema.characterRelations)
          .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: existingDuplicate.version + 1 })
          .where(eq(schema.characterRelations.id, existingDuplicate.id));
      } else {
        console.warn(`Sync conflict (update): Existing CharacterRelation ${existingDuplicate.id} is newer or same as incoming ${update.id}. Discarding incoming update for ${update.id} as it would create a duplicate.`);
        return; // Discard the incoming update
      }
    }

    await this.db.update(schema.characterRelations)
      .set({
        ...mappedRelationChanges,
        storyId: storyId,
        updatedAt: new Date(update.operationTime || new Date()), // Use incoming updatedAt if present, else new Date
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

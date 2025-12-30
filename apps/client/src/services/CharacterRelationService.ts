import { AppDrizzleClient, characterRelations } from '../db';
import { CharacterRelation, ServerCharacterRelationPayload } from '@keres/shared/entities/CharacterRelation';
import { createULID } from '../utils/ulid';
import { and, eq, or, sql } from 'drizzle-orm';
import { entityEventEmitter } from '../utils/EventEmitter'; // Import for event emission
import { getChangedFields } from '../utils/diffUtils'; // Import for changed fields in update
import { getUserIdForOperation, recordLocalOperation } from '../utils/syncUtils'; // Imports for logging operations
import { createServerService } from './ServerService'; // Import ServerService to get userId

export interface CharacterRelationServiceInterface {
  getRelationsForCharacter(storyId: string, characterId: string): Promise<CharacterRelation[]>;
  saveCharacterRelation(currentUserId: string, relation: CharacterRelation): Promise<CharacterRelation>; // Added currentUserId
  deleteCharacterRelation(currentUserId: string, relationId: string): Promise<boolean>; // Added currentUserId
}

// Helper function to map client-side CharacterRelation to server-side payload structure
const toServerCharacterRelationPayload = (
  clientRelation: Partial<CharacterRelation>
): Partial<ServerCharacterRelationPayload> => {
  const serverPayload: Partial<ServerCharacterRelationPayload> = {
    ...clientRelation,
  };

  if (clientRelation.charId1 !== undefined) {
    serverPayload.character1Id = clientRelation.charId1;
    delete (serverPayload as any).charId1; // Remove client-specific field
  }
  if (clientRelation.charId2 !== undefined) {
    serverPayload.character2Id = clientRelation.charId2;
    delete (serverPayload as any).charId2; // Remove client-specific field
  }
  return serverPayload;
};

export const createCharacterRelationService = (db: AppDrizzleClient): CharacterRelationServiceInterface => {
  const serverService = createServerService(db);
  return {
    async getRelationsForCharacter(storyId: string, characterId: string): Promise<CharacterRelation[]> {
      if (!storyId || !characterId) {
        console.error('getRelationsForCharacter: storyId and characterId are required.');
        return [];
      }
      try {
        const relations = await db.select()
          .from(characterRelations)
          .where(and(
            eq(characterRelations.storyId, storyId),
            or(
              eq(characterRelations.charId1, characterId),
              eq(characterRelations.charId2, characterId)
            ),
            eq(characterRelations.isDeleted, false)
          ))
          .all();
        return relations;
      } catch (error) {
        console.error(`Error fetching character relations for character ${characterId}:`, error);
        return [];
      }
    },

    async saveCharacterRelation(currentUserId: string, relation: CharacterRelation): Promise<CharacterRelation> { // Added currentUserId
      try {
        console.log('Attempting to save relation with ID:', relation.id, 'and storyId:', relation.storyId, 'Relation:', relation);

        // Helper to check if a relation with this ID exists in the DB
        const checkIfRelationExists = async (id: string): Promise<boolean> => {
            const existing = await db.query.characterRelations.findFirst({
                where: and(eq(characterRelations.id, id), eq(characterRelations.isDeleted, false)),
            });
            return !!existing;
        };

        let resultRelation: CharacterRelation; // To store the final relation to return

        if (relation.id && relation.id !== '') {
          const exists = await checkIfRelationExists(relation.id);

          if (exists) {
            // Fetch old relation for diffing
            const oldRelation = await db.query.characterRelations.findFirst({ where: eq(characterRelations.id, relation.id) });
            if (!oldRelation) {
                throw new Error(`Old relation with ID ${relation.id} not found during update preparation.`);
            }

            // Record exists, proceed with update
            const [updatedRelation] = await db.update(characterRelations)
              .set({
                charId1: relation.charId1,
                charId2: relation.charId2,
                relationType: relation.relationType,
                updatedAt: new Date(),
                version: sql`${characterRelations.version} + 1`,
              })
              .where(eq(characterRelations.id, relation.id))
              .returning();

            if (!updatedRelation) {
              console.error('Update operation did not return any updated rows for ID:', relation.id);
              throw new Error('Failed to retrieve updated relation after update operation.');
            }
            resultRelation = updatedRelation;

            // Log update operation
            const changedFields = getChangedFields(oldRelation, updatedRelation);
            const userIdToLog = await getUserIdForOperation(db, serverService, updatedRelation.storyId, currentUserId);

            // Transform changedFields to server-compatible payload
            const serverPayload = toServerCharacterRelationPayload(changedFields);
            
            await recordLocalOperation(db, updatedRelation.storyId, userIdToLog, 'update', 'CharacterRelation', relation.id, serverPayload);
            entityEventEmitter.emit('character_relation_changed', updatedRelation.storyId, updatedRelation.id);
            return resultRelation; // Early return for successful update
          }
          console.log(`Relation with ID ${relation.id} not found for update, attempting insert instead.`);
          // If exists is false, fall through to insert logic
        }

        // --- INSERT LOGIC (either because relation.id was empty/undefined OR because it didn't exist for update) ---
        const newRelationData: CharacterRelation = {
          ...relation,
          id: relation.id && relation.id !== '' ? relation.id : createULID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          isDeleted: false,
          deletedAt: null,
        };
        console.log('Inserting new relation with generated ID:', newRelationData.id);
        const [insertedRelation] = await db.insert(characterRelations)
                                         .values(newRelationData)
                                         .returning();
        if (!insertedRelation) {
            console.error('Insert operation did not return any inserted rows.');
            throw new Error('Failed to retrieve inserted relation after insert operation.');
        }
        resultRelation = insertedRelation;

        // Log create operation
        const userIdToLog = await getUserIdForOperation(db, serverService, resultRelation.storyId, currentUserId);
        
        // Transform resultRelation to server-compatible payload
        const serverPayload = toServerCharacterRelationPayload(resultRelation);

        await recordLocalOperation(db, resultRelation.storyId, userIdToLog, 'create', 'CharacterRelation', resultRelation.id, serverPayload);
        entityEventEmitter.emit('character_relation_changed', resultRelation.storyId, resultRelation.id);

        return resultRelation; // Return the actual inserted object from DB

      } catch (error) {
        console.error('Error saving character relation:', error);
        throw error;
      }
    },

    async deleteCharacterRelation(currentUserId: string, relationId: string): Promise<boolean> { // Added currentUserId
      try {
        const relationToDelete = await db.query.characterRelations.findFirst({ where: eq(characterRelations.id, relationId) });
        if (!relationToDelete) {
          console.warn(`Attempted to delete non-existent character relation ${relationId}.`);
          return false; // Return false if not found
        }

        const [updatedRelation] = await db.update(characterRelations)
          .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: sql`${characterRelations.version} + 1` })
          .where(eq(characterRelations.id, relationId))
          .returning(); // Returning the updated relation

        if (!updatedRelation) {
          throw new Error(`Failed to delete character relation ${relationId} or relation not found.`);
        }

        // Log delete operation
        const changedFields = {
          id: updatedRelation.id,
          isDeleted: updatedRelation.isDeleted,
          version: updatedRelation.version,
        };
        const userIdToLog = await getUserIdForOperation(db, serverService, updatedRelation.storyId, currentUserId);
        await recordLocalOperation(db, updatedRelation.storyId, userIdToLog, 'delete', 'CharacterRelation', relationId, changedFields);
        entityEventEmitter.emit('character_relation_changed', updatedRelation.storyId, updatedRelation.id);

        return true;
      } catch (error) {
        console.error(`Error deleting character relation ${relationId}:`, error);
        return false;
      }
    },
  };
};
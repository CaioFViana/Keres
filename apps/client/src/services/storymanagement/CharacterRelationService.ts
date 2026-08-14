import {
  CharacterRelation,
  ServerCharacterRelationPayload,
} from '@keres/shared/entities/CharacterRelation';
import { and, asc, desc, eq, or, sql, SQL } from 'drizzle-orm'; // Import SQL
import { alias } from 'drizzle-orm/sqlite-core'; // Import alias for table aliasing
import { AppDrizzleClient, characterRelations, characters } from '../../db';
import { createULID, getChangedFields } from '../../utils/entityUtils'; // Import for changed fields in update
import { entityEventEmitter } from '../../utils/EventEmitter'; // Import for event emission
import { getUserIdForOperation, recordLocalOperation } from '../../utils/syncUtils'; // Imports for logging operations
import { createServerService } from '../ServerService'; // Import ServerService to get userId

export type CharacterRelationWithNames = CharacterRelation & {
  char1Name: string;
  char2Name: string;
};

export interface CharacterRelationServiceInterface {
  getRelationsForCharacter(storyId: string, characterId: string): Promise<CharacterRelation[]>;
  saveCharacterRelation(
    currentUserId: string,
    relation: CharacterRelation,
  ): Promise<CharacterRelation>; // Added currentUserId
  deleteCharacterRelation(currentUserId: string, relationId: string): Promise<boolean>; // Added currentUserId
  getCharacterRelationsByStoryId(
    storyId: string,
    searchTerm?: string,
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    advancedSearchCriteria?: { [key: string]: any },
  ): Promise<CharacterRelationWithNames[]>;
}

// Helper function to map client-side CharacterRelation to server-side payload structure
const toServerCharacterRelationPayload = (
  clientRelation: Partial<CharacterRelation>,
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

// Helper function to find an existing non-deleted relation for a given pair of characters
const getExistingRelationForPair = async (
  db: AppDrizzleClient,
  storyId: string,
  charIdA: string,
  charIdB: string,
  excludeRelationId?: string,
): Promise<CharacterRelation | undefined> => {
  const conditions = [
    eq(characterRelations.storyId, storyId),
    eq(characterRelations.isDeleted, false),
    or(
      and(eq(characterRelations.charId1, charIdA), eq(characterRelations.charId2, charIdB)),
      and(eq(characterRelations.charId1, charIdB), eq(characterRelations.charId2, charIdA)),
    ),
  ];

  if (excludeRelationId) {
    conditions.push(sql`${characterRelations.id} != ${excludeRelationId}`);
  }

  return db.query.characterRelations.findFirst({
    where: and(...conditions),
  });
};

export const createCharacterRelationService = (
  db: AppDrizzleClient,
): CharacterRelationServiceInterface => {
  const serverService = createServerService(db);
  return {
    async getRelationsForCharacter(
      storyId: string,
      characterId: string,
    ): Promise<CharacterRelation[]> {
      if (!storyId || !characterId) {
        console.error('getRelationsForCharacter: storyId and characterId are required.');
        return [];
      }
      try {
        const relations = await db
          .select()
          .from(characterRelations)
          .where(
            and(
              eq(characterRelations.storyId, storyId),
              or(
                eq(characterRelations.charId1, characterId),
                eq(characterRelations.charId2, characterId),
              ),
              eq(characterRelations.isDeleted, false),
            ),
          )
          .all();
        return relations;
      } catch (error) {
        console.error(`Error fetching character relations for character ${characterId}:`, error);
        return [];
      }
    },

    async saveCharacterRelation(
      currentUserId: string,
      relation: CharacterRelation,
    ): Promise<CharacterRelation> {
      // Added currentUserId
      try {
        console.log(
          'Attempting to save relation with ID:',
          relation.id,
          'and storyId:',
          relation.storyId,
          'Relation:',
          relation,
        );

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
            const oldRelation = await db.query.characterRelations.findFirst({
              where: eq(characterRelations.id, relation.id),
            });
            if (!oldRelation) {
              throw new Error(
                `Old relation with ID ${relation.id} not found during update preparation.`,
              );
            }

            // Prevent changing charId1 or charId2 on update ---
            if (
              oldRelation.charId1 !== relation.charId1 ||
              oldRelation.charId2 !== relation.charId2
            ) {
              throw new Error(`Character IDs (charId1, charId2) cannot be changed on an existing CharacterRelation.
                                 Old: ${oldRelation.charId1}, ${oldRelation.charId2} | New: ${relation.charId1}, ${relation.charId2}`);
            }

            // Check for duplicate pair BEFORE update ---
            const duplicateExisting = await getExistingRelationForPair(
              db,
              relation.storyId,
              relation.charId1,
              relation.charId2,
              relation.id,
            );
            if (duplicateExisting) {
              throw new Error(
                `A relation between character ${relation.charId1} and ${relation.charId2} already exists with ID ${duplicateExisting.id}.`,
              );
            }

            // Use getChangedFields to determine if there are substantive changes
            const potentialNewState = { ...oldRelation, ...relation };
            const changes = getChangedFields(oldRelation, potentialNewState);
            delete changes.version;
            delete changes.updatedAt;

            if (Object.keys(changes).length === 0) {
              console.log(
                `CharacterRelation ${relation.id}: No significant changes detected. Skipping update and operation log.`,
              );
              return oldRelation; // Return the original relation as no update occurred
            }

            // Record exists, proceed with update
            const [updatedRelation] = await db
              .update(characterRelations)
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
              console.error(
                'Update operation did not return any updated rows for ID:',
                relation.id,
              );
              throw new Error('Failed to retrieve updated relation after update operation.');
            }
            resultRelation = updatedRelation;

            // Log update operation
            const changedFields = getChangedFields(oldRelation, updatedRelation);

            const userIdToLog = await getUserIdForOperation(
              db,
              serverService,
              updatedRelation.storyId,
              currentUserId,
            );
            // Transform changedFields to server-compatible payload
            const serverPayload = toServerCharacterRelationPayload(changedFields);

            await recordLocalOperation(
              db,
              updatedRelation.storyId,
              userIdToLog,
              'update',
              'CharacterRelation',
              relation.id,
              serverPayload,
            );
            entityEventEmitter.emit(
              'character_relation_changed',
              updatedRelation.storyId,
              updatedRelation.id,
            );
            return resultRelation; // Early return for successful update
          }
          console.log(
            `Relation with ID ${relation.id} not found for update, attempting insert instead.`,
          );
          // If exists is false, fall through to insert logic
        }

        // Check for duplicate pair BEFORE insert ---
        const duplicateExisting = await getExistingRelationForPair(
          db,
          relation.storyId,
          relation.charId1,
          relation.charId2,
        );
        if (duplicateExisting) {
          throw new Error(
            `A relation between character ${relation.charId1} and ${relation.charId2} already exists with ID ${duplicateExisting.id}.`,
          );
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
        const [insertedRelation] = await db
          .insert(characterRelations)
          .values(newRelationData)
          .returning();
        if (!insertedRelation) {
          console.error('Insert operation did not return any inserted rows.');
          throw new Error('Failed to retrieve inserted relation after insert operation.');
        }
        resultRelation = insertedRelation;

        // Log create operation
        const userIdToLog = await getUserIdForOperation(
          db,
          serverService,
          resultRelation.storyId,
          currentUserId,
        );

        // Transform resultRelation to server-compatible payload
        const serverPayload = toServerCharacterRelationPayload(resultRelation);

        await recordLocalOperation(
          db,
          resultRelation.storyId,
          userIdToLog,
          'create',
          'CharacterRelation',
          resultRelation.id,
          serverPayload,
        );
        entityEventEmitter.emit(
          'character_relation_changed',
          resultRelation.storyId,
          resultRelation.id,
        );

        return resultRelation; // Return the actual inserted object from DB
      } catch (error) {
        console.error('Error saving character relation:', error);
        throw error;
      }
    },

    async deleteCharacterRelation(currentUserId: string, relationId: string): Promise<boolean> {
      // Added currentUserId
      try {
        const relationToDelete = await db.query.characterRelations.findFirst({
          where: eq(characterRelations.id, relationId),
        });
        if (!relationToDelete) {
          console.warn(`Attempted to delete non-existent character relation ${relationId}.`);
          return false; // Return false if not found
        }

        const [updatedRelation] = await db
          .update(characterRelations)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
            version: sql`${characterRelations.version} + 1`,
          })
          .where(eq(characterRelations.id, relationId))
          .returning(); // Returning the updated relation

        if (!updatedRelation) {
          throw new Error(
            `Failed to delete character relation ${relationId} or relation not found.`,
          );
        }

        // Log delete operation
        const changedFields = {
          id: updatedRelation.id,
          isDeleted: updatedRelation.isDeleted,
          version: updatedRelation.version,
        };
        const userIdToLog = await getUserIdForOperation(
          db,
          serverService,
          updatedRelation.storyId,
          currentUserId,
        );
        await recordLocalOperation(
          db,
          updatedRelation.storyId,
          userIdToLog,
          'delete',
          'CharacterRelation',
          relationId,
          changedFields,
        );
        entityEventEmitter.emit(
          'character_relation_changed',
          updatedRelation.storyId,
          updatedRelation.id,
        );

        return true;
      } catch (error) {
        console.error(`Error deleting character relation ${relationId}:`, error);
        return false;
      }
    },

    async getCharacterRelationsByStoryId(
      storyId: string,
      searchTerm?: string,
      sortBy?: string | null,
      sortDirection?: 'asc' | 'desc',
      advancedSearchCriteria?: { [key: string]: any },
    ): Promise<CharacterRelationWithNames[]> {
      const char1 = alias(characters, 'char1');
      const char2 = alias(characters, 'char2');

      const conditions = [
        eq(characterRelations.storyId, storyId),
        eq(characterRelations.isDeleted, false),
      ];

      // Apply search term to character names and relation type
      if (searchTerm) {
        conditions.push(
          or(
            sql`${char1.name} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>,
            sql`${char2.name} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>,
            sql`${characterRelations.relationType} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>,
          ) as SQL<boolean>, // Explicit cast for the entire OR expression
        );
      }

      // Apply advanced search criteria for relationType
      if (advancedSearchCriteria?.relationType) {
        conditions.push(
          sql`${characterRelations.relationType} LIKE ${`%${advancedSearchCriteria.relationType}%`} COLLATE NOCASE` as SQL<boolean>,
        );
      }

      // Main query with joins to get character names
      let query = db
        .select({
          relation: characterRelations,
          char1Name: char1.name,
          char2Name: char2.name,
        })
        .from(characterRelations)
        .innerJoin(char1, eq(characterRelations.charId1, char1.id))
        .innerJoin(char2, eq(characterRelations.charId2, char2.id))
        .where(and(...conditions))
        .$dynamic();

      // Apply sorting
      if (sortBy) {
        const order = sortDirection === 'desc' ? desc : asc;
        switch (sortBy) {
          case 'relationType':
            query = query.orderBy(order(characterRelations.relationType));
            break;
          case 'char1Name':
            query = query.orderBy(order(char1.name));
            break;
          case 'char2Name':
            query = query.orderBy(order(char2.name));
            break;
          case 'createdAt':
            query = query.orderBy(order(characterRelations.createdAt));
            break;
          case 'updatedAt':
            query = query.orderBy(order(characterRelations.updatedAt));
            break;
          default:
            console.warn(`Unknown sortBy field for CharacterRelation: ${sortBy}`);
            break;
        }
      } else {
        query = query.orderBy(asc(characterRelations.relationType)); // Default sort
      }

      const results = await query.all();

      return results.map((row) => ({
        ...row.relation,
        char1Name: row.char1Name,
        char2Name: row.char2Name,
      }));
    },
  };
};

import { sortIdPair } from '@keres/shared';
import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, or, sql } from 'drizzle-orm'; // Import SQL
import { alias } from 'drizzle-orm/sqlite-core'; // Import alias for table aliasing
import type { AppDrizzleClient } from '../../db';
import { characterRelations, characters } from '../../db';
import { createULID, getChangedFields } from '../../utils/entityUtils'; // Import for changed fields in update
import { entityEventEmitter } from '../../utils/EventEmitter'; // Import for event emission
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils'; // Imports for logging operations
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
      and(
        eq(characterRelations.character1Id, charIdA),
        eq(characterRelations.character2Id, charIdB),
      ),
      and(
        eq(characterRelations.character1Id, charIdB),
        eq(characterRelations.character2Id, charIdA),
      ),
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
                eq(characterRelations.character1Id, characterId),
                eq(characterRelations.character2Id, characterId),
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
      await assertStoryIsWritable(db, relation.storyId);
      try {
        console.log(
          'Attempting to save relation with ID:',
          relation.id,
          'and storyId:',
          relation.storyId,
          'Relation:',
          relation,
        );

        let resultRelation: CharacterRelation; // To store the final relation to return

        if (relation.id && relation.id !== '') {
          const rowById = await db.query.characterRelations.findFirst({
            where: eq(characterRelations.id, relation.id),
          });

          if (rowById?.isDeleted) {
            // The row is a tombstone: restore it in place instead of falling through to the
            // insert below, which would collide on the primary key. Endpoints stay immutable
            // and the pair check still excludes this very row, exactly like a live update.
            if (
              rowById.character1Id !== relation.character1Id ||
              rowById.character2Id !== relation.character2Id
            ) {
              throw new Error(`Character IDs (character1Id, character2Id) cannot be changed on an existing CharacterRelation.
                                 Old: ${rowById.character1Id}, ${rowById.character2Id} | New: ${relation.character1Id}, ${relation.character2Id}`);
            }
            const restoreDuplicate = await getExistingRelationForPair(
              db,
              relation.storyId,
              relation.character1Id,
              relation.character2Id,
              relation.id,
            );
            if (restoreDuplicate) {
              throw new Error(
                `A relation between character ${relation.character1Id} and ${relation.character2Id} already exists with ID ${restoreDuplicate.id}.`,
              );
            }
            const restoreUserId = await getUserIdForOperation(
              db,
              serverService,
              rowById.storyId,
              currentUserId,
            );
            const restoredRelation = await runLocalWrite(db, rowById.storyId, () => {
              const restored = db
                .update(characterRelations)
                .set({
                  relationType: relation.relationType,
                  isDeleted: false,
                  deletedAt: null,
                  updatedAt: new Date(),
                  version: sql`${characterRelations.version} + 1`,
                })
                .where(eq(characterRelations.id, relation.id))
                .returning()
                .get();
              if (!restored) {
                throw new Error('Failed to retrieve restored relation after update operation.');
              }
              recordLocalOperationSync(
                db,
                restored.storyId,
                restoreUserId,
                'update',
                'CharacterRelation',
                relation.id,
                getChangedFields(rowById, restored),
              );
              return restored;
            });
            entityEventEmitter.emit(
              'character_relation_changed',
              restoredRelation.storyId,
              restoredRelation.id,
            );
            return restoredRelation;
          }

          if (!!rowById && !rowById.isDeleted) {
            // Fetch old relation for diffing
            const oldRelation = await db.query.characterRelations.findFirst({
              where: eq(characterRelations.id, relation.id),
            });
            if (!oldRelation) {
              throw new Error(
                `Old relation with ID ${relation.id} not found during update preparation.`,
              );
            }

            // Prevent changing character1Id or character2Id on update ---
            if (
              oldRelation.character1Id !== relation.character1Id ||
              oldRelation.character2Id !== relation.character2Id
            ) {
              throw new Error(`Character IDs (character1Id, character2Id) cannot be changed on an existing CharacterRelation.
                                 Old: ${oldRelation.character1Id}, ${oldRelation.character2Id} | New: ${relation.character1Id}, ${relation.character2Id}`);
            }

            // Check for duplicate pair BEFORE update ---
            const duplicateExisting = await getExistingRelationForPair(
              db,
              relation.storyId,
              relation.character1Id,
              relation.character2Id,
              relation.id,
            );
            if (duplicateExisting) {
              throw new Error(
                `A relation between character ${relation.character1Id} and ${relation.character2Id} already exists with ID ${duplicateExisting.id}.`,
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

            const userIdToLog = await getUserIdForOperation(
              db,
              serverService,
              oldRelation.storyId,
              currentUserId,
            );

            // Record exists, proceed with update
            const updatedRelation = await runLocalWrite(db, oldRelation.storyId, () => {
              const updated = db
                .update(characterRelations)
                .set({
                  character1Id: relation.character1Id,
                  character2Id: relation.character2Id,
                  relationType: relation.relationType,
                  updatedAt: new Date(),
                  version: sql`${characterRelations.version} + 1`,
                })
                .where(eq(characterRelations.id, relation.id))
                .returning()
                .get();

              if (!updated) {
                console.error(
                  'Update operation did not return any updated rows for ID:',
                  relation.id,
                );
                throw new Error('Failed to retrieve updated relation after update operation.');
              }

              recordLocalOperationSync(
                db,
                updated.storyId,
                userIdToLog,
                'update',
                'CharacterRelation',
                relation.id,
                getChangedFields(oldRelation, updated),
              );
              return updated;
            });
            resultRelation = updatedRelation;
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
          relation.character1Id,
          relation.character2Id,
        );
        if (duplicateExisting) {
          throw new Error(
            `A relation between character ${relation.character1Id} and ${relation.character2Id} already exists with ID ${duplicateExisting.id}.`,
          );
        }

        // --- INSERT LOGIC (either because relation.id was empty/undefined OR because it didn't exist for update) ---
        // The pair is stored sorted, as the server stores it: one relation, one way of writing it.
        const [character1Id, character2Id] = sortIdPair(
          relation.character1Id,
          relation.character2Id,
        );
        const newRelationData: CharacterRelation = {
          ...relation,
          character1Id,
          character2Id,
          id: relation.id && relation.id !== '' ? relation.id : createULID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          isDeleted: false,
          deletedAt: null,
        };
        const userIdToLog = await getUserIdForOperation(
          db,
          serverService,
          newRelationData.storyId,
          currentUserId,
        );
        console.log('Inserting new relation with generated ID:', newRelationData.id);
        resultRelation = await runLocalWrite(db, newRelationData.storyId, () => {
          const inserted = db.insert(characterRelations).values(newRelationData).returning().get();
          if (!inserted) {
            console.error('Insert operation did not return any inserted rows.');
            throw new Error('Failed to retrieve inserted relation after insert operation.');
          }
          recordLocalOperationSync(
            db,
            inserted.storyId,
            userIdToLog,
            'create',
            'CharacterRelation',
            inserted.id,
            inserted,
          );
          return inserted;
        });
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
      const relationToDelete = await db.query.characterRelations.findFirst({
        where: eq(characterRelations.id, relationId),
      });
      if (!relationToDelete) {
        console.warn(`Attempted to delete non-existent character relation ${relationId}.`);
        return false; // Return false if not found
      }
      // Outside the try below: that catch swallows everything into `false`, which would
      // turn a refused write into a silent no-op instead of an explicit error.
      await assertStoryIsWritable(db, relationToDelete.storyId);
      try {
        const userIdToLog = await getUserIdForOperation(
          db,
          serverService,
          relationToDelete.storyId,
          currentUserId,
        );
        const updatedRelation = await runLocalWrite(db, relationToDelete.storyId, () => {
          const deleted = db
            .update(characterRelations)
            .set({
              isDeleted: true,
              deletedAt: new Date(),
              updatedAt: new Date(),
              version: sql`${characterRelations.version} + 1`,
            })
            .where(eq(characterRelations.id, relationId))
            .returning()
            .get();

          if (!deleted) {
            throw new Error(
              `Failed to delete character relation ${relationId} or relation not found.`,
            );
          }

          recordLocalOperationSync(
            db,
            deleted.storyId,
            userIdToLog,
            'delete',
            'CharacterRelation',
            relationId,
            {
              id: deleted.id,
              isDeleted: deleted.isDeleted,
              version: deleted.version,
            },
          );
          return deleted;
        });
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
        .innerJoin(char1, eq(characterRelations.character1Id, char1.id))
        .innerJoin(char2, eq(characterRelations.character2Id, char2.id))
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

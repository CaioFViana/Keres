import { and, eq, sql } from 'drizzle-orm';
import { createULID } from '../utils/ulid';
import { CharacterScene as CharacterSceneInterface } from '@keres/shared/entities/CharacterScene';
import { AppDrizzleClient } from '../db';
import * as schema from '../db/schema';
import { getUserIdForOperation, recordLocalOperation } from '../utils/syncUtils';
import { createServerService } from './ServerService';
import { getChangedFields } from '../utils/diffUtils';

export type NewCharacterScene = Omit<CharacterSceneInterface, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>;
export type SaveCharacterScene = NewCharacterScene & { id?: string };

export interface CharacterSceneServiceInterface {
  getRelationsForScene(storyId: string, sceneId: string): Promise<CharacterSceneInterface[]>;
  getRelationsForCharacter(storyId: string, characterId: string): Promise<CharacterSceneInterface[]>;
  saveCharacterScene(userId: string, relation: SaveCharacterScene): Promise<CharacterSceneInterface>;
  deleteCharacterScene(userId: string, relationId: string): Promise<boolean>;
}

const getExistingCharacterSceneForPair = async (
  drizzleDb: AppDrizzleClient,
  storyId: string,
  characterId: string,
  sceneId: string,
  excludeRelationId?: string
): Promise<CharacterSceneInterface | undefined> => {
  const conditions = [
    eq(schema.characterScenes.storyId, storyId),
    eq(schema.characterScenes.characterId, characterId),
    eq(schema.characterScenes.sceneId, sceneId),
    eq(schema.characterScenes.isDeleted, false)
  ];

  if (excludeRelationId) {
    conditions.push(sql`${schema.characterScenes.id} != ${excludeRelationId}`);
  }

  return drizzleDb.query.characterScenes.findFirst({
    where: and(...conditions),
  });
};

export function createCharacterSceneService(drizzleDb: AppDrizzleClient): CharacterSceneServiceInterface {
  const serverService = createServerService(drizzleDb);

  return {
    async getRelationsForScene(storyId: string, sceneId: string): Promise<CharacterSceneInterface[]> {
      try {
        const relations = await drizzleDb.query.characterScenes.findMany({
          where: and(
            eq(schema.characterScenes.storyId, storyId),
            eq(schema.characterScenes.sceneId, sceneId),
            eq(schema.characterScenes.isDeleted, false)
          ),
        });
        return relations;
      } catch (error) {
        console.error('Error fetching character-scene relations for scene:', error);
        throw error;
      }
    },

    async getRelationsForCharacter(storyId: string, characterId: string): Promise<CharacterSceneInterface[]> {
      try {
        const relations = await drizzleDb.query.characterScenes.findMany({
          where: and(
            eq(schema.characterScenes.storyId, storyId),
            eq(schema.characterScenes.characterId, characterId),
            eq(schema.characterScenes.isDeleted, false)
          ),
        });
        return relations;
      } catch (error) {
        console.error('Error fetching character-scene relations for character:', error);
        throw error;
      }
    },

    async saveCharacterScene(userId: string, relation: SaveCharacterScene): Promise<CharacterSceneInterface> {
      try {
        let resultRelation: CharacterSceneInterface;

        if (relation.id && relation.id !== '') {
          const existingRelation = await drizzleDb.query.characterScenes.findFirst({
            where: eq(schema.characterScenes.id, relation.id),
          });

          if (existingRelation && !existingRelation.isDeleted) {
            const duplicateExisting = await getExistingCharacterSceneForPair(
              drizzleDb,
              relation.storyId,
              relation.characterId,
              relation.sceneId,
              relation.id
            );
            if (duplicateExisting) {
                throw new Error(`A character-scene relation for character ${relation.characterId} and scene ${relation.sceneId} already exists with ID ${duplicateExisting.id}.`);
            }

            const potentialNewState = { ...existingRelation, ...relation };
            const changes = getChangedFields(existingRelation, potentialNewState);
            delete changes.version;
            delete changes.updatedAt;

            if (Object.keys(changes).length === 0) {
              console.log(`CharacterScene ${relation.id}: No significant changes detected. Skipping update and operation log.`);
              return existingRelation;
            }

            const [updatedRelation] = await drizzleDb.update(schema.characterScenes)
              .set({
                characterId: relation.characterId,
                sceneId: relation.sceneId,
                updatedAt: new Date(),
                version: sql`${schema.characterScenes.version} + 1`,
              })
              .where(eq(schema.characterScenes.id, relation.id))
              .returning();

            if (!updatedRelation) {
              throw new Error('Failed to retrieve updated character-scene relation after update operation.');
            }
            resultRelation = updatedRelation;

            const userIdToLog = await getUserIdForOperation(drizzleDb, serverService, resultRelation.storyId, userId);
            await recordLocalOperation(drizzleDb, resultRelation.storyId, userIdToLog, 'update', 'CharacterScene', resultRelation.id, getChangedFields(existingRelation, resultRelation));
            return resultRelation;
          }
        }

        const duplicateExisting = await getExistingCharacterSceneForPair(
          drizzleDb,
          relation.storyId,
          relation.characterId,
          relation.sceneId
        );
        if (duplicateExisting) {
            throw new Error(`A character-scene relation for character ${relation.characterId} and scene ${relation.sceneId} already exists with ID ${duplicateExisting.id}.`);
        }
        
        const newId = createULID();
        const now = new Date();
        const characterSceneToInsert: CharacterSceneInterface = {
          ...relation as NewCharacterScene,
          id: newId,
          createdAt: now,
          updatedAt: now,
          version: 1,
          isDeleted: false,
          deletedAt: null,
        };

        const [insertedRelation] = await drizzleDb.insert(schema.characterScenes)
                                         .values(characterSceneToInsert)
                                         .returning();
        if (!insertedRelation) {
            throw new Error('Failed to retrieve inserted character-scene relation after insert operation.');
        }
        resultRelation = insertedRelation;
        
        const userIdToLog = await getUserIdForOperation(drizzleDb, serverService, resultRelation.storyId, userId);
        await recordLocalOperation(drizzleDb, resultRelation.storyId, userIdToLog, 'create', 'CharacterScene', resultRelation.id, resultRelation);
        
        return resultRelation;

      } catch (error) {
        console.error('Error saving character-scene relation:', error);
        throw error;
      }
    },

    async deleteCharacterScene(userId: string, relationId: string): Promise<boolean> {
      try {
        const existingRelation = await drizzleDb.query.characterScenes.findFirst({
          where: eq(schema.characterScenes.id, relationId),
        });

        if (!existingRelation) {
          console.warn(`CharacterScene with ID ${relationId} not found for deletion.`);
          return false;
        }

        const now = new Date();
        const [updatedRelation] = await drizzleDb.update(schema.characterScenes)
          .set({ isDeleted: true, deletedAt: now, updatedAt: now, version: existingRelation.version + 1 })
          .where(eq(schema.characterScenes.id, relationId))
          .returning();

        if (!updatedRelation) {
          throw new Error(`Failed to delete character-scene relation ${relationId} or relation not found.`);
        }
        
        const userIdToLog = await getUserIdForOperation(drizzleDb, serverService, updatedRelation.storyId, userId);
        await recordLocalOperation(drizzleDb, updatedRelation.storyId, userIdToLog, 'delete', 'CharacterScene', relationId, { id: relationId, isDeleted: true, version: updatedRelation.version });

        return true;
      } catch (error) {
        console.error('Error deleting character-scene relation:', error);
        throw error;
      }
    },
  };
}
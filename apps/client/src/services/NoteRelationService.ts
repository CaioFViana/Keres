import { SQL, and, eq, sql } from 'drizzle-orm';
import { createULID } from '../utils/ulid';
import { NoteRelationEntities, NoteRelation as NoteRelationInterface } from '@keres/shared/entities/Note';
import { AppDrizzleClient } from '../db';
import * as schema from '../db/schema';
import { getUserIdForOperation, recordLocalOperation } from '../utils/syncUtils';
import { createServerService } from './ServerService';
import { getChangedFields } from '../utils/diffUtils';

export type NewNoteRelation = Omit<NoteRelationInterface, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>;
export type SaveNoteRelation = NewNoteRelation & { id?: string };

export interface NoteRelationServiceInterface {
  getRelationsForEntity(storyId: string, entityId: string, entityType: NoteRelationEntities): Promise<NoteRelationInterface[]>;
  getRelationsForNote(storyId: string, noteId: string): Promise<NoteRelationInterface[]>;
  saveNoteRelation(userId: string, relation: SaveNoteRelation): Promise<NoteRelationInterface>;
  deleteNoteRelation(userId: string, relationId: string): Promise<boolean>;
}

const getExistingNoteRelationForPair = async (
  drizzleDb: AppDrizzleClient,
  storyId: string,
  noteId: string,
  relationId: string,
  relationType: NoteRelationEntities,
  excludeRelationId?: string
): Promise<NoteRelationInterface | undefined> => {
  const conditions = [
    eq(schema.noteRelations.storyId, storyId),
    eq(schema.noteRelations.noteId, noteId),
    eq(schema.noteRelations.relationId, relationId),
    eq(schema.noteRelations.relationType, relationType),
    eq(schema.noteRelations.isDeleted, false)
  ];

  if (excludeRelationId) {
    conditions.push(sql`${schema.noteRelations.id} != ${excludeRelationId}`);
  }

  return drizzleDb.query.noteRelations.findFirst({
    where: and(...conditions),
  });
};

export function createNoteRelationService(drizzleDb: AppDrizzleClient): NoteRelationServiceInterface {
  const serverService = createServerService(drizzleDb);

  return {
    async getRelationsForEntity(storyId: string, entityId: string, entityType: NoteRelationEntities): Promise<NoteRelationInterface[]> {
      try {
        const relations = await drizzleDb.query.noteRelations.findMany({
          where: and(
            eq(schema.noteRelations.storyId, storyId),
            eq(schema.noteRelations.relationId, entityId),
            eq(schema.noteRelations.relationType, entityType),
            eq(schema.noteRelations.isDeleted, false)
          ),
        });
        return relations;
      } catch (error) {
        console.error('Error fetching note relations for entity:', error);
        throw error;
      }
    },

    async getRelationsForNote(storyId: string, noteId: string): Promise<NoteRelationInterface[]> {
      try {
        const relations = await drizzleDb.query.noteRelations.findMany({
          where: and(
            eq(schema.noteRelations.storyId, storyId),
            eq(schema.noteRelations.noteId, noteId),
            eq(schema.noteRelations.isDeleted, false)
          ),
        });
        return relations;
      } catch (error) {
        console.error('Error fetching note relations for note:', error);
        throw error;
      }
    },

    async saveNoteRelation(userId: string, relation: SaveNoteRelation): Promise<NoteRelationInterface> {
      try {
        let resultRelation: NoteRelationInterface;

        if (relation.id && relation.id !== '') {
          const existingRelation = await drizzleDb.query.noteRelations.findFirst({
            where: eq(schema.noteRelations.id, relation.id),
          });

          if (existingRelation && !existingRelation.isDeleted) {
            const duplicateExisting = await getExistingNoteRelationForPair(
              drizzleDb,
              relation.storyId,
              relation.noteId,
              relation.relationId,
              relation.relationType as NoteRelationEntities,
              relation.id
            );
            if (duplicateExisting) {
                throw new Error(`A note relation for note ${relation.noteId} and entity ${relation.relationId} (${relation.relationType}) already exists with ID ${duplicateExisting.id}.`);
            }

            const potentialNewState = { ...existingRelation, ...relation };
            const changes = getChangedFields(existingRelation, potentialNewState);
            delete changes.version;
            delete changes.updatedAt;

            if (Object.keys(changes).length === 0) {
              console.log(`NoteRelation ${relation.id}: No significant changes detected. Skipping update and operation log.`);
              return existingRelation;
            }

            const [updatedRelation] = await drizzleDb.update(schema.noteRelations)
              .set({
                noteId: relation.noteId,
                relationId: relation.relationId,
                relationType: relation.relationType,
                updatedAt: new Date(),
                version: sql`${schema.noteRelations.version} + 1`,
              })
              .where(eq(schema.noteRelations.id, relation.id))
              .returning();

            if (!updatedRelation) {
              throw new Error('Failed to retrieve updated note relation after update operation.');
            }
            resultRelation = updatedRelation;

            const userIdToLog = await getUserIdForOperation(drizzleDb, serverService, resultRelation.storyId, userId);
            await recordLocalOperation(drizzleDb, resultRelation.storyId, userIdToLog, 'update', 'NoteRelation', resultRelation.id, getChangedFields(existingRelation, resultRelation));
            return resultRelation;
          }
        }

        const duplicateExisting = await getExistingNoteRelationForPair(
          drizzleDb,
          relation.storyId,
          relation.noteId,
          relation.relationId,
          relation.relationType as NoteRelationEntities
        );
        if (duplicateExisting) {
            throw new Error(`A note relation for note ${relation.noteId} and entity ${relation.relationId} (${relation.relationType}) already exists with ID ${duplicateExisting.id}.`);
        }
        
        const newId = createULID();
        const now = new Date();
        const noteRelationToInsert: NoteRelationInterface = {
          ...relation as NewNoteRelation,
          id: newId,
          createdAt: now,
          updatedAt: now,
          version: 1,
          isDeleted: false,
          deletedAt: null,
        };

        const [insertedRelation] = await drizzleDb.insert(schema.noteRelations)
                                         .values(noteRelationToInsert)
                                         .returning();
        if (!insertedRelation) {
            throw new Error('Failed to retrieve inserted note relation after insert operation.');
        }
        resultRelation = insertedRelation;
        
        const userIdToLog = await getUserIdForOperation(drizzleDb, serverService, resultRelation.storyId, userId);
        await recordLocalOperation(drizzleDb, resultRelation.storyId, userIdToLog, 'create', 'NoteRelation', resultRelation.id, resultRelation);
        
        return resultRelation;

      } catch (error) {
        console.error('Error saving note relation:', error);
        throw error;
      }
    },

    async deleteNoteRelation(userId: string, relationId: string): Promise<boolean> {
      try {
        const existingRelation = await drizzleDb.query.noteRelations.findFirst({
          where: eq(schema.noteRelations.id, relationId),
        });

        if (!existingRelation) {
          console.warn(`NoteRelation with ID ${relationId} not found for deletion.`);
          return false;
        }

        const now = new Date();
        const [updatedRelation] = await drizzleDb.update(schema.noteRelations)
          .set({ isDeleted: true, deletedAt: now, updatedAt: now, version: existingRelation.version + 1 })
          .where(eq(schema.noteRelations.id, relationId))
          .returning();

        if (!updatedRelation) {
          throw new Error(`Failed to delete note relation ${relationId} or relation not found.`);
        }
        
        const userIdToLog = await getUserIdForOperation(drizzleDb, serverService, updatedRelation.storyId, userId);
        await recordLocalOperation(drizzleDb, updatedRelation.storyId, userIdToLog, 'delete', 'NoteRelation', relationId, { id: relationId, isDeleted: true, version: updatedRelation.version });

        return true;
      } catch (error) {
        console.error('Error deleting note relation:', error);
        throw error;
      }
    },
  };
}
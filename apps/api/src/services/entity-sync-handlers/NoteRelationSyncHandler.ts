import type {
  CreateNoteRelationDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  NoteRelationEntities,
  UpdateStoryUpdate} from '@keres/shared';
import {
  CreateNoteRelationDataSchema,
  PartialNoteRelationSchema
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import {
  chapters,
  characters,
  locations,
  noteRelations,
  notes,
  scenes,
  worldRules,
} from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class NoteRelationSyncHandler extends BaseSyncEntityHandler<
  typeof CreateNoteRelationDataSchema,
  typeof PartialNoteRelationSchema
> {
  entityName = 'NoteRelation';

  constructor() {
    super(
      'noteRelations',
      'id',
      'version',
      CreateNoteRelationDataSchema,
      PartialNoteRelationSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      },
    );
  }

  private async validateRelatedEntities(
    storyId: string,
    noteId: string,
    relationId: string,
    relationType: NoteRelationEntities,
  ): Promise<void> {
    // Validate note exists
    const noteExists = await db.query.notes.findFirst({
      where: and(eq(notes.id, noteId), eq(notes.storyId, storyId), eq(notes.isDeleted, false)),
    });
    if (!noteExists) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Note with ID ${noteId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }

    // Validate relationId based on relationType
    switch (relationType) {
      case 'Character':
        const charExists = await db.query.characters.findFirst({
          where: and(
            eq(characters.id, relationId),
            eq(characters.storyId, storyId),
            eq(characters.isDeleted, false),
          ),
        });
        if (!charExists) {
          throw new SyncConflictError(
            'referenced_entity_deleted',
            `Validation Error: Character with ID ${relationId} not found, is deleted, or does not belong to story ${storyId}.`,
          );
        }
        break;
      case 'Location':
        const locationExists = await db.query.locations.findFirst({
          where: and(
            eq(locations.id, relationId),
            eq(locations.storyId, storyId),
            eq(locations.isDeleted, false),
          ),
        });
        if (!locationExists) {
          throw new SyncConflictError(
            'referenced_entity_deleted',
            `Validation Error: Location with ID ${relationId} not found, is deleted, or does not belong to story ${storyId}.`,
          );
        }
        break;
      case 'WorldRule':
        const worldRuleExists = await db.query.worldRules.findFirst({
          where: and(
            eq(worldRules.id, relationId),
            eq(worldRules.storyId, storyId),
            eq(worldRules.isDeleted, false),
          ),
        });
        if (!worldRuleExists) {
          throw new SyncConflictError(
            'referenced_entity_deleted',
            `Validation Error: WorldRule with ID ${relationId} not found, is deleted, or does not belong to story ${storyId}.`,
          );
        }
        break;
      case 'Scene':
        const sceneExists = await db.query.scenes.findFirst({
          where: and(
            eq(scenes.id, relationId),
            eq(scenes.storyId, storyId),
            eq(scenes.isDeleted, false),
          ),
        });
        if (!sceneExists) {
          throw new SyncConflictError(
            'referenced_entity_deleted',
            `Validation Error: Scene with ID ${relationId} not found, is deleted, or does not belong to story ${storyId}.`,
          );
        }
        break;
      case 'Chapter':
        const chapterExists = await db.query.chapters.findFirst({
          where: and(
            eq(chapters.id, relationId),
            eq(chapters.storyId, storyId),
            eq(chapters.isDeleted, false),
          ),
        });
        if (!chapterExists) {
          throw new SyncConflictError(
            'referenced_entity_deleted',
            `Validation Error: Chapter with ID ${relationId} not found, is deleted, or does not belong to story ${storyId}.`,
          );
        }
        break;
      default:
        throw new Error(
          `Validation Error: Unsupported NoteRelationEntities type: ${relationType}.`,
        );
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateNoteRelationDataType = this.createSchema.parse(update.data);

    // Validate related entities
    await this.validateRelatedEntities(
      storyId,
      validatedData.noteId,
      validatedData.relationId,
      validatedData.relationType,
    );

    // Check for uniqueness of the NoteRelation
    const existingRelation = await db.query.noteRelations.findFirst({
      where: and(
        eq(noteRelations.storyId, storyId),
        eq(noteRelations.noteId, validatedData.noteId),
        eq(noteRelations.relationId, validatedData.relationId),
        eq(noteRelations.relationType, validatedData.relationType),
        eq(noteRelations.isDeleted, false),
      ),
    });

    if (existingRelation) {
      throw new Error(
        `Conflict: NoteRelation for note ${validatedData.noteId} and entity ${validatedData.relationId} (${validatedData.relationType}) already exists and is not deleted.`,
      );
    }

    await db.insert(noteRelations).values({
      id: update.id!,
      storyId: storyId,
      noteId: validatedData.noteId,
      relationId: validatedData.relationId,
      relationType: validatedData.relationType,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    // Prevent changing core identifiers of the relation
    if (validatedChanges.noteId && validatedChanges.noteId !== currentEntity.noteId) {
      throw new Error("Validation Error: Cannot change 'noteId' of an existing NoteRelation.");
    }
    if (validatedChanges.relationId && validatedChanges.relationId !== currentEntity.relationId) {
      throw new Error("Validation Error: Cannot change 'relationId' of an existing NoteRelation.");
    }
    if (
      validatedChanges.relationType &&
      validatedChanges.relationType !== currentEntity.relationType
    ) {
      throw new Error(
        "Validation Error: Cannot change 'relationType' of an existing NoteRelation.",
      );
    }

    // No other fields are directly updatable in NoteRelation,
    // so if only these were provided in changes, the base update will handle it (e.g., isDeleted)
    // If there were other fields to update, add specific logic here.

    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    // The base handler's delete should work correctly with the 'id' column
    await super.delete(userId, storyId, update, currentEntity);
  }
}

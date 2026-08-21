import {
  CreateCharacterRelationDataSchema,
  CreateCharacterRelationDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  PartialCharacterRelationSchema,
  UpdateStoryUpdate,
} from '@keres/shared';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '../../db';
import { characterRelations, characters } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class CharacterRelationSyncHandler extends BaseSyncEntityHandler<
  typeof CreateCharacterRelationDataSchema,
  typeof PartialCharacterRelationSchema
> {
  entityName = 'CharacterRelation';

  constructor() {
    super(
      'characterRelations',
      'id',
      'version',
      CreateCharacterRelationDataSchema,
      PartialCharacterRelationSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      },
    );
  }

  private sortCharacterIds(id1: string, id2: string): [string, string] {
    return id1 < id2 ? [id1, id2] : [id2, id1];
  }

  private async validateRelatedEntities(
    storyId: string,
    character1Id: string,
    character2Id: string,
  ): Promise<void> {
    if (character1Id === character2Id) {
      throw new Error('Validation Error: character1Id and character2Id cannot be identical.');
    }

    const char1Exists = await db.query.characters.findFirst({
      where: and(
        eq(characters.id, character1Id),
        eq(characters.storyId, storyId),
        eq(characters.isDeleted, false),
      ),
    });
    if (!char1Exists) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Character 1 with ID ${character1Id} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }

    const char2Exists = await db.query.characters.findFirst({
      where: and(
        eq(characters.id, character2Id),
        eq(characters.storyId, storyId),
        eq(characters.isDeleted, false),
      ),
    });
    if (!char2Exists) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Character 2 with ID ${character2Id} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateCharacterRelationDataType = this.createSchema.parse(update.data);

    // Sort character IDs to ensure consistent storage and uniqueness checks
    const [sortedChar1Id, sortedChar2Id] = this.sortCharacterIds(
      validatedData.character1Id,
      validatedData.character2Id,
    );

    // Validate related entities
    await this.validateRelatedEntities(storyId, sortedChar1Id, sortedChar2Id);

    // Check for uniqueness of the relation (considering sorted IDs)
    const existingRelation = await db.query.characterRelations.findFirst({
      where: and(
        eq(characterRelations.storyId, storyId),
        eq(characterRelations.character1Id, sortedChar1Id),
        eq(characterRelations.character2Id, sortedChar2Id),
        eq(characterRelations.isDeleted, false),
      ),
    });

    if (existingRelation) {
      throw new Error(
        `Conflict: CharacterRelation between ${sortedChar1Id} and ${sortedChar2Id} already exists and is not deleted.`,
      );
    }

    await db.insert(characterRelations).values({
      id: update.id!,
      storyId: storyId,
      character1Id: sortedChar1Id,
      character2Id: sortedChar2Id,
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

    let newChar1Id = validatedChanges.character1Id || currentEntity.character1Id;
    let newChar2Id = validatedChanges.character2Id || currentEntity.character2Id;

    // If character IDs are being updated, sort them and re-validate
    if (validatedChanges.character1Id || validatedChanges.character2Id) {
      [newChar1Id, newChar2Id] = this.sortCharacterIds(newChar1Id, newChar2Id);
      await this.validateRelatedEntities(storyId, newChar1Id, newChar2Id);

      // After sorting, update the validatedChanges to reflect the sorted IDs
      validatedChanges.character1Id = newChar1Id;
      validatedChanges.character2Id = newChar2Id;

      // Check for uniqueness of the new relation (if character IDs were changed)
      const existingRelation = await db.query.characterRelations.findFirst({
        where: and(
          eq(characterRelations.storyId, storyId),
          eq(characterRelations.character1Id, newChar1Id),
          eq(characterRelations.character2Id, newChar2Id),
          eq(characterRelations.isDeleted, false),
          // Ensure we are not conflicting with the entity being updated itself
          ne(characterRelations.id, update.id!),
        ),
      });

      if (existingRelation) {
        throw new Error(
          `Conflict: CharacterRelation between ${newChar1Id} and ${newChar2Id} already exists and is not deleted.`,
        );
      }
    }

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

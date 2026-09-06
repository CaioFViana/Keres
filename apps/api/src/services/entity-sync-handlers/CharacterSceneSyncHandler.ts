import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  CreateCharacterSceneDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateCharacterSceneDataSchema, PartialCharacterSceneSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { characters, characterScenes, scenes } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class CharacterSceneSyncHandler extends BaseSyncEntityHandler<
  typeof CreateCharacterSceneDataSchema,
  typeof PartialCharacterSceneSchema
> {
  entityName = 'CharacterScene';

  constructor() {
    super(
      'id', // Now using a single 'id' column
      'version',
      CreateCharacterSceneDataSchema,
      PartialCharacterSceneSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      },
    );
  }

  private async validateRelatedEntities(
    storyId: string,
    characterId: string,
    sceneId: string,
  ): Promise<void> {
    const characterExists = await db.query.characters.findFirst({
      where: and(
        eq(characters.id, characterId),
        eq(characters.storyId, storyId),
        eq(characters.isDeleted, false),
      ),
    });

    if (!characterExists) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Character with ID ${characterId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }

    const sceneExists = await db.query.scenes.findFirst({
      where: and(eq(scenes.id, sceneId), eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)),
    });

    if (!sceneExists) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Scene with ID ${sceneId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateCharacterSceneDataType = this.createSchema.parse(update.data);

    // Validate related entities
    await this.validateRelatedEntities(storyId, validatedData.characterId, validatedData.sceneId);

    // Check for uniqueness based on characterId and sceneId
    const existingCharacterScene = await db.query.characterScenes.findFirst({
      where: and(
        eq(characterScenes.characterId, validatedData.characterId),
        eq(characterScenes.sceneId, validatedData.sceneId),
        eq(characterScenes.storyId, storyId),
        eq(characterScenes.isDeleted, false),
      ),
    });

    if (existingCharacterScene) {
      throw new Error(
        `Conflict: CharacterScene for Character ID ${validatedData.characterId} and Scene ID ${validatedData.sceneId} already exists and is not deleted.`,
      );
    }

    await db.insert(characterScenes).values({
      id: update.id!,
      characterId: validatedData.characterId,
      sceneId: validatedData.sceneId,
      storyId: storyId,
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
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
  ): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    // If characterId or sceneId are being updated, validate them
    if (validatedChanges.characterId || validatedChanges.sceneId) {
      const newCharacterId = validatedChanges.characterId || currentEntity.characterId;
      const newSceneId = validatedChanges.sceneId || currentEntity.sceneId;
      await this.validateRelatedEntities(storyId, newCharacterId, newSceneId);
    }

    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
  ): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
  }
}

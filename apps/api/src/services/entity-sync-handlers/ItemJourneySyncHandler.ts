import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { characters, itemJourneys, items, scenes } from '../../db/schema';
import { CreateItemJourneyDataSchema, CreateItemJourneyDataType, PartialItemJourneySchema } from '../../schemas/ItemJourneySchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class ItemJourneySyncHandler extends BaseSyncEntityHandler<typeof CreateItemJourneyDataSchema, typeof PartialItemJourneySchema> {
  entityName = 'ItemJourney';

  constructor() {
    super(
      'itemJourneys',
      'id',
      'version',
      CreateItemJourneyDataSchema,
      PartialItemJourneySchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  private async validateRelatedEntities(
    storyId: string,
    itemId: string,
    sceneId: string,
    newCharacterOwnerId: string | null
  ): Promise<void> {
    const itemExists = await db.query.items.findFirst({
      where: and(eq(items.id, itemId), eq(items.storyId, storyId), eq(items.isDeleted, false)),
    });
    if (!itemExists) {
      throw new Error(`Validation Error: Item with ID ${itemId} not found, is deleted, or does not belong to story ${storyId}.`);
    }

    const sceneExists = await db.query.scenes.findFirst({
      where: and(eq(scenes.id, sceneId), eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)),
    });
    if (!sceneExists) {
      throw new Error(`Validation Error: Scene with ID ${sceneId} not found, is deleted, or does not belong to story ${storyId}.`);
    }

    if (newCharacterOwnerId) {
      const characterExists = await db.query.characters.findFirst({
        where: and(eq(characters.id, newCharacterOwnerId), eq(characters.storyId, storyId), eq(characters.isDeleted, false)),
      });
      if (!characterExists) {
        throw new Error(`Validation Error: Character with ID ${newCharacterOwnerId} not found, is deleted, or does not belong to story ${storyId}.`);
      }
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateItemJourneyDataType = this.createSchema.parse(update.data);

    await this.validateRelatedEntities(
      storyId,
      validatedData.itemId,
      validatedData.sceneId,
      validatedData.newCharacterOwnerid
    );

    const currentItemJourney = await this.findById(update.id!);
    if (currentItemJourney) {
      throw new Error(`Conflict: ItemJourney with ID ${update.id} already exists.`);
    }

    await db.insert(itemJourneys).values({
      id: update.id!,
      storyId: storyId,
      itemId: validatedData.itemId,
      sceneId: validatedData.sceneId,
      newCharacterOwnerId: validatedData.newCharacterOwnerid,
      newState: validatedData.newState,
      extraNotes: validatedData.extraNotes,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    const newItemId = validatedChanges.itemId ?? currentEntity.itemId;
    const newSceneId = validatedChanges.sceneId ?? currentEntity.sceneId;
    const newCharacterOwnerId = validatedChanges.newCharacterOwnerid ?? currentEntity.newCharacterOwnerId;
    
    // Validate related entities if any foreign key is being updated
    if (validatedChanges.itemId !== undefined || validatedChanges.sceneId !== undefined || validatedChanges.newCharacterOwnerid !== undefined) {
        await this.validateRelatedEntities(storyId, newItemId, newSceneId, newCharacterOwnerId);
    }

    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(userId: string, storyId: string, update: DeleteStoryUpdate, currentEntity: any): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
  }
}

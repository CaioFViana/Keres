import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { choices, scenes } from '../../db/schema';
import { CreateChoiceDataSchema, CreateChoiceDataType, PartialChoiceSchema } from '../../schemas/ChoiceSchemas';
import { CreateStoryUpdate, UpdateStoryUpdate } from '../../schemas/SyncSchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class ChoiceSyncHandler extends BaseSyncEntityHandler<typeof CreateChoiceDataSchema, typeof PartialChoiceSchema> {
  entityName = 'Choice';

  constructor() {
    super(
      'choices', // Pass table name as string
      'id',
      'version',
      CreateChoiceDataSchema,
      PartialChoiceSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  private async validateRelatedEntities(storyId: string, sceneId: string, nextSceneId: string): Promise<void> {
    const sceneExists = await db.query.scenes.findFirst({
      where: and(eq(scenes.id, sceneId), eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)),
    });

    if (!sceneExists) {
      throw new Error(`Scene with ID ${sceneId} not found or does not belong to story ${storyId}.`);
    }

    const nextSceneExists = await db.query.scenes.findFirst({
      where: and(eq(scenes.id, nextSceneId), eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)),
    });

    if (!nextSceneExists) {
      throw new Error(`Next Scene with ID ${nextSceneId} not found or does not belong to story ${storyId}.`);
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CreateChoiceDataType = this.createSchema.parse(update.data);

    const currentChoice = await this.findById(update.id!);
    if (currentChoice) {
      throw new Error(`Conflict: Choice with ID ${update.id} already exists.`);
    }

    await this.validateRelatedEntities(storyId, validatedData.sceneId, validatedData.nextSceneId);

    await db.insert(choices).values({
      id: update.id!, // Explicitly provide ID from update, as it's a ULID from client
      storyId: storyId, // Ensure storyId is set from the context
      ...validatedData, // Spread the validated data from the client
      version: 1, // Ensure version starts at 1 for new creations
      createdAt: new Date(), // Ensure createdAt is set
      updatedAt: new Date(), // Ensure updatedAt is set
      isDeleted: false, // Ensure isDeleted is false
      deletedAt: null, // Ensure deletedAt is null
    });
  }

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    const newSceneId = validatedChanges.sceneId !== undefined ? validatedChanges.sceneId : currentEntity.sceneId;
    const newNextSceneId = validatedChanges.nextSceneId !== undefined ? validatedChanges.nextSceneId : currentEntity.nextSceneId;

    await this.validateRelatedEntities(storyId, newSceneId, newNextSceneId);

    await db.update(choices)
      .set({
        ...validatedChanges,
        updatedAt: new Date(),
        version: currentEntity.version + 1,
      })
      .where(and(
        eq(choices.id, update.id!),
        eq(choices.version, currentEntity.version)
      ));
  }
}

import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { chapters, locations, scenes } from '../../db/schema';
import { CreateSceneDataSchema, CreateSceneDataType, PartialSceneSchema } from '../../schemas/SceneSchemas';
import { CreateStoryUpdate, UpdateStoryUpdate } from '../../schemas/SyncSchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class SceneSyncHandler extends BaseSyncEntityHandler<typeof CreateSceneDataSchema, typeof PartialSceneSchema> {
  entityName = 'Scene';

  constructor() {
    super(
      'scenes', // Pass table name as string
      'id',
      'version',
      CreateSceneDataSchema,
      PartialSceneSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  private async validateRelatedEntities(storyId: string, chapterId: string, locationId: string): Promise<void> {
    // Validate Chapter
    const chapter = await db.query.chapters.findFirst({
      where: and(
        eq(chapters.id, chapterId),
        eq(chapters.storyId, storyId),
        eq(chapters.isDeleted, false)
      ),
    });
    if (!chapter) {
      throw new Error(`Validation Error: Chapter with ID ${chapterId} not found, is deleted, or does not belong to story ${storyId}.`);
    }

    // Validate Location
    const location = await db.query.locations.findFirst({
      where: and(
        eq(locations.id, locationId),
        eq(locations.storyId, storyId),
        eq(locations.isDeleted, false)
      ),
    });
    if (!location) {
      throw new Error(`Validation Error: Location with ID ${locationId} not found, is deleted, or does not belong to story ${storyId}.`);
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CreateSceneDataType = this.createSchema.parse(update.data);

    const currentScene = await this.findById(update.id!);
    if (currentScene) {
      throw new Error(`Conflict: Scene with ID ${update.id} already exists.`);
    }

    // Validate related entities
    await this.validateRelatedEntities(storyId, validatedData.chapterId, validatedData.locationId);

    await db.insert(scenes).values({
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

    // If chapterId or locationId are being updated, validate them
    if (validatedChanges.chapterId || validatedChanges.locationId) {
      const newChapterId = validatedChanges.chapterId || currentEntity.chapterId;
      const newLocationId = validatedChanges.locationId || currentEntity.locationId;
      await this.validateRelatedEntities(storyId, newChapterId, newLocationId);
    }

    await db.update(scenes)
      .set({
        ...validatedChanges,
        updatedAt: new Date(),
        version: currentEntity.version + 1,
      })
      .where(and(
        eq(scenes.id, update.id!),
        eq(scenes.version, currentEntity.version)
      ));
  }
}

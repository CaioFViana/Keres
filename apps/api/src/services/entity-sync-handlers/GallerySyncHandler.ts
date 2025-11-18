import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { characters, galleries, locations, notes, scenes } from '../../db/schema';
import { CreateGalleryDataSchema, CreateGalleryDataType, PartialGallerySchema } from '../../schemas/GallerySchemas';
import { CreateStoryUpdate, UpdateStoryUpdate } from '../../schemas/SyncSchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class GallerySyncHandler extends BaseSyncEntityHandler<typeof CreateGalleryDataSchema, typeof PartialGallerySchema> {
  entityName = 'Gallery';

  constructor() {
    super(
      'galleries', // Pass table name as string
      'id',
      'version',
      CreateGalleryDataSchema,
      PartialGallerySchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  private async validateRelatedEntities(storyId: string, ownerId: string, ownerType: 'Character' | 'Location' | 'Note' | 'Scene' | null): Promise<void> {
    if (!ownerType) {
      return; // No ownerType, no specific entity to validate against
    }

    let ownerExists = false;
    switch (ownerType) {
      case 'Character':
        const character = await db.query.characters.findFirst({
          where: and(eq(characters.id, ownerId), eq(characters.storyId, storyId), eq(characters.isDeleted, false)),
        });
        ownerExists = !!character;
        break;
      case 'Location':
        const location = await db.query.locations.findFirst({
          where: and(eq(locations.id, ownerId), eq(locations.storyId, storyId), eq(locations.isDeleted, false)),
        });
        ownerExists = !!location;
        break;
      case 'Note':
        const note = await db.query.notes.findFirst({
          where: and(eq(notes.id, ownerId), eq(notes.storyId, storyId), eq(notes.isDeleted, false)),
        });
        ownerExists = !!note;
        break;
      case 'Scene':
        const scene = await db.query.scenes.findFirst({
          where: and(eq(scenes.id, ownerId), eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)),
        });
        ownerExists = !!scene;
        break;
      default:
        throw new Error(`Invalid ownerType: ${ownerType}`);
    }

    if (!ownerExists) {
      throw new Error(`${ownerType} with ID ${ownerId} not found or does not belong to story ${storyId}.`);
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CreateGalleryDataType = this.createSchema.parse(update.data);

    const currentGallery = await this.findById(update.id!);
    if (currentGallery) {
      throw new Error(`Conflict: Gallery with ID ${update.id} already exists.`);
    }

    await this.validateRelatedEntities(storyId, validatedData.ownerId, validatedData.ownerType);

    await db.insert(galleries).values({
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

    // If ownerId or ownerType are being updated, validate them
    if (validatedChanges.ownerId !== undefined || validatedChanges.ownerType !== undefined) {
      const newOwnerId = validatedChanges.ownerId !== undefined ? validatedChanges.ownerId : currentEntity.ownerId;
      const newOwnerType = validatedChanges.ownerType !== undefined ? validatedChanges.ownerType : currentEntity.ownerType;
      await this.validateRelatedEntities(storyId, newOwnerId, newOwnerType);
    }

    await db.update(galleries)
      .set({
        ...validatedChanges,
        updatedAt: new Date(),
        version: currentEntity.version + 1,
      })
      .where(and(
        eq(galleries.id, update.id!),
        eq(galleries.version, currentEntity.version)
      ));
  }
}

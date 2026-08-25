import type {
  CreateGalleryRelationDataType,
  CreateStoryUpdate,
  GalleryOwnerEntity,
  UpdateStoryUpdate} from '@keres/shared';
import {
  CreateGalleryRelationDataSchema,
  PartialGalleryRelationSchema
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import {
  characters,
  galleries,
  galleryRelations,
  items,
  locations,
  notes,
  scenes,
} from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

/**
 * Sincroniza o vínculo entre uma mídia e uma entidade da história.
 *
 * Mesma forma do `TagRelationSyncHandler`: o dono é polimórfico, então a existência dele
 * é conferida aqui em vez de por foreign key.
 */
export class GalleryRelationSyncHandler extends BaseSyncEntityHandler<
  typeof CreateGalleryRelationDataSchema,
  typeof PartialGalleryRelationSchema
> {
  entityName = 'GalleryRelation';

  constructor() {
    super(
      'galleryRelations',
      'id',
      'version',
      CreateGalleryRelationDataSchema,
      PartialGalleryRelationSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      },
    );
  }

  private async validateRelation(
    storyId: string,
    galleryId: string,
    ownerId: string,
    ownerType: GalleryOwnerEntity,
  ): Promise<void> {
    const galleryExists = await db.query.galleries.findFirst({
      where: and(
        eq(galleries.id, galleryId),
        eq(galleries.storyId, storyId),
        eq(galleries.isDeleted, false),
      ),
    });
    if (!galleryExists) {
      // A create-then-link pair (Gallery, then this relation) can arrive with the relation
      // ahead of its gallery if the client's push batch ever reorders them - report this as
      // a diagnosable 'not_found' conflict rather than an opaque 'unknown' one.
      throw new SyncConflictError(
        'not_found',
        `Gallery with ID ${galleryId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }

    let ownerExists = false;
    switch (ownerType) {
      case 'Character': {
        const character = await db.query.characters.findFirst({
          where: and(
            eq(characters.id, ownerId),
            eq(characters.storyId, storyId),
            eq(characters.isDeleted, false),
          ),
        });
        ownerExists = !!character;
        break;
      }
      case 'Location': {
        const location = await db.query.locations.findFirst({
          where: and(
            eq(locations.id, ownerId),
            eq(locations.storyId, storyId),
            eq(locations.isDeleted, false),
          ),
        });
        ownerExists = !!location;
        break;
      }
      case 'Note': {
        const note = await db.query.notes.findFirst({
          where: and(eq(notes.id, ownerId), eq(notes.storyId, storyId), eq(notes.isDeleted, false)),
        });
        ownerExists = !!note;
        break;
      }
      case 'Scene': {
        const scene = await db.query.scenes.findFirst({
          where: and(
            eq(scenes.id, ownerId),
            eq(scenes.storyId, storyId),
            eq(scenes.isDeleted, false),
          ),
        });
        ownerExists = !!scene;
        break;
      }
      case 'Item': {
        const item = await db.query.items.findFirst({
          where: and(eq(items.id, ownerId), eq(items.storyId, storyId), eq(items.isDeleted, false)),
        });
        ownerExists = !!item;
        break;
      }
      default:
        throw new Error(`Validation Error: Unknown gallery ownerType "${ownerType}".`);
    }

    if (!ownerExists) {
      // Same reasoning as the gallery-existence check above: a diagnosable 'not_found'
      // conflict instead of an opaque 'unknown' one.
      throw new SyncConflictError(
        'not_found',
        `${ownerType} with ID ${ownerId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }
  }

  /** O par (mídia, dono) é único enquanto estiver ativo; o tombstone não conta. */
  private async findActiveDuplicate(
    storyId: string,
    galleryId: string,
    ownerId: string,
    ownerType: string,
  ) {
    return db.query.galleryRelations.findFirst({
      where: and(
        eq(galleryRelations.storyId, storyId),
        eq(galleryRelations.galleryId, galleryId),
        eq(galleryRelations.ownerId, ownerId),
        eq(galleryRelations.ownerType, ownerType),
        eq(galleryRelations.isDeleted, false),
      ),
    });
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateGalleryRelationDataType = this.createSchema.parse(update.data);

    const current = await this.findById(update.id!);
    if (current) {
      throw new Error(`Conflict: GalleryRelation with ID ${update.id} already exists.`);
    }

    await this.validateRelation(
      storyId,
      validatedData.galleryId,
      validatedData.ownerId,
      validatedData.ownerType,
    );

    const duplicate = await this.findActiveDuplicate(
      storyId,
      validatedData.galleryId,
      validatedData.ownerId,
      validatedData.ownerType,
    );
    if (duplicate) {
      throw new Error(
        `Conflict: Gallery ${validatedData.galleryId} is already linked to ${validatedData.ownerType} ${validatedData.ownerId} in story ${storyId}.`,
      );
    }

    await db.insert(galleryRelations).values({
      id: update.id!,
      storyId: storyId,
      galleryId: validatedData.galleryId,
      ownerId: validatedData.ownerId,
      ownerType: validatedData.ownerType,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
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

    const retargeted =
      validatedChanges.galleryId !== undefined ||
      validatedChanges.ownerId !== undefined ||
      validatedChanges.ownerType !== undefined;

    if (retargeted) {
      const newGalleryId = validatedChanges.galleryId ?? currentEntity.galleryId;
      const newOwnerId = validatedChanges.ownerId ?? currentEntity.ownerId;
      const newOwnerType = validatedChanges.ownerType ?? currentEntity.ownerType;

      await this.validateRelation(storyId, newGalleryId, newOwnerId, newOwnerType);

      const duplicate = await this.findActiveDuplicate(
        storyId,
        newGalleryId,
        newOwnerId,
        newOwnerType,
      );
      if (duplicate && duplicate.id !== update.id) {
        throw new Error(
          `Conflict: Gallery ${newGalleryId} is already linked to ${newOwnerType} ${newOwnerId} in story ${storyId}.`,
        );
      }
    }

    await super.update(userId, storyId, update, currentEntity);
  }
}

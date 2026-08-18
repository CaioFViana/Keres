import {
  CreateGalleryDataSchema,
  CreateGalleryDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  isSupportedMediaMimeType,
  mediaTypeForMimeType,
  PartialGallerySchema,
  UpdateStoryUpdate,
} from '@keres/shared';
import { db } from '../../db';
import { galleries } from '../../db/schema';
import { mediaStorageService } from '../MediaStorageService';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

/**
 * Sincroniza os *metadados* de uma mídia. Os bytes não passam por aqui: eles sobem e
 * descem pelas rotas `/media`, endereçados pelo `hash` que esta linha carrega.
 *
 * Não há validação de dono porque a mídia não tem dono - o vínculo com personagens,
 * locais, notas, cenas e itens vive em `GalleryRelationSyncHandler`.
 */
export class GallerySyncHandler extends BaseSyncEntityHandler<
  typeof CreateGalleryDataSchema,
  typeof PartialGallerySchema
> {
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
      },
    );
  }

  /**
   * Recusa formatos que o aplicativo não conseguiria exibir e `mediaType` incoerente com
   * o `mimeType`. Deixar passar produziria mídia que sincroniza e depois não abre.
   */
  private assertSupportedMedia(mimeType: string, mediaType: string): void {
    if (!isSupportedMediaMimeType(mimeType)) {
      throw new Error(`Validation Error: unsupported media MIME type "${mimeType}".`);
    }
    const expected = mediaTypeForMimeType(mimeType);
    if (expected !== mediaType) {
      throw new Error(
        `Validation Error: mediaType "${mediaType}" does not match MIME type "${mimeType}" (expected "${expected}").`,
      );
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CreateGalleryDataType = this.createSchema.parse(update.data);

    const currentGallery = await this.findById(update.id!);
    if (currentGallery) {
      throw new Error(`Conflict: Gallery with ID ${update.id} already exists.`);
    }

    this.assertSupportedMedia(validatedData.mimeType, validatedData.mediaType);

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

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    if (validatedChanges.mimeType !== undefined || validatedChanges.mediaType !== undefined) {
      this.assertSupportedMedia(
        validatedChanges.mimeType ?? currentEntity.mimeType,
        validatedChanges.mediaType ?? currentEntity.mediaType,
      );
    }

    // Delegated to the base class instead of a raw version-matched UPDATE reimplemented here:
    // that reimplementation had no `checkVersionConflict`, no `deleted_on_server` check, and
    // used server time instead of the client's `operationTime` - a concurrent edit landed here
    // with no error and no conflict reported, just silently dropped (same bug already found
    // and fixed in NoteSyncHandler/WorldRuleSyncHandler, just never cleaned up in this sibling).
    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
    // A linha vira tombstone acima, mas o hash pode ser usado por outra Gallery (mesma
    // história ou outra, já que o armazenamento é dedupado globalmente) - só o blob deixa
    // de ter dono quando nenhuma referência viva sobra.
    await mediaStorageService.deleteBlobIfUnreferenced(currentEntity.hash);
  }
}

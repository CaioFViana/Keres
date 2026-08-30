import type { GalleryOwnerEntity, MediaType } from '@keres/shared';
import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { GalleryInsert, GallerySelect, MediaTransferState } from '../../db/schema';
import { galleries, galleryRelations } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import {
  decorateFavorite,
  normalizeFavoriteCreate,
  normalizeFavoriteUpdate,
  persistInitialFavorite,
} from './favoriteBehaviorUtils';
import type { FavoriteFilterState } from '../../types/entityFilters';

export type { FavoriteFilterState };

/** Fields that describe only this device's state and do not belong in the operation log. */
const LOCAL_ONLY_FIELDS = ['localPath', 'uploadState', 'downloadState', 'thumbnailPath'] as const;

/**
 * Removes the local columns from the payload before writing it into the operation log.
 *
 * The server would discard them anyway (its zod ignores unknown keys), but letting them out of here
 * would fill the log with one device's file paths, which mean nothing on any other, and would make
 * conflict resolution see "changes" where only a download finished.
 */
function syncablePayload(row: Record<string, any>): Record<string, any> {
  const payload = { ...row };
  for (const field of LOCAL_ONLY_FIELDS) {
    delete payload[field];
  }
  return payload;
}

export interface GalleryFilters {
  searchTerm?: string;
  mediaTypes?: MediaType[];
  favoriteFilterState?: FavoriteFilterState;
  sortBy?: string | null;
  sortDirection?: 'asc' | 'desc';
}

/** The data of a freshly imported media file, with the file already written locally. */
export interface NewGalleryMedia {
  storyId: string;
  mediaType: MediaType;
  mimeType: string;
  fileName: string;
  hash: string;
  sizeBytes: number;
  sourceUrl?: string | null;
  localPath: string | null;
  /** Video only. */
  thumbnailPath?: string;
  title?: string | null;
  extraNotes?: string | null;
  isFavorite?: boolean;
}

export interface GalleryService {
  getGalleriesByStoryId(storyId: string, filters?: GalleryFilters): Promise<GallerySelect[]>;
  getById(galleryId: string): Promise<GallerySelect | undefined>;
  /** This story's media with these bytes, if it already exists. The basis of dedupe on import. */
  getByHash(storyId: string, hash: string): Promise<GallerySelect | undefined>;
  getGalleriesForOwner(
    storyId: string,
    ownerId: string,
    ownerType: GalleryOwnerEntity,
  ): Promise<GallerySelect[]>;
  createGallery(currentUserId: string, media: NewGalleryMedia): Promise<GallerySelect>;
  updateGallery(
    currentUserId: string,
    galleryId: string,
    data: Partial<Pick<GalleryInsert, 'title' | 'extraNotes' | 'isFavorite' | 'fileName'>>,
  ): Promise<void>;
  updateGalleryFavoriteStatus(
    currentUserId: string,
    galleryId: string,
    isFavorite: boolean,
  ): Promise<void>;
  deleteGallery(currentUserId: string, galleryId: string): Promise<void>;
  /**
   * Updates only the transfer/local-file state. It deliberately generates no operation and does not
   * increment `version`: none of this exists outside this device.
   */
  setLocalFileState(
    galleryId: string,
    state: {
      localPath?: string | null;
      uploadState?: MediaTransferState;
      downloadState?: MediaTransferState;
      thumbnailPath?: string | null;
    },
  ): Promise<void>;
  /** Media whose bytes have not been uploaded yet. */
  getPendingUploads(storyId: string): Promise<GallerySelect[]>;
  /** Media that exists as metadata but whose file is not on the device yet. */
  getPendingDownloads(storyId: string): Promise<GallerySelect[]>;
}

export const createGalleryService = (db: AppDrizzleClient): GalleryService => {
  const serverService = createServerService(db);

  return {
    async getGalleriesByStoryId(storyId, filters = {}): Promise<GallerySelect[]> {
      const { searchTerm, mediaTypes, favoriteFilterState, sortBy, sortDirection } = filters;

      const conditions: SQL<boolean>[] = [
        eq(galleries.storyId, storyId) as SQL<boolean>,
        eq(galleries.isDeleted, false) as SQL<boolean>,
      ];

      if (searchTerm) {
        // It searches the title and the file name: the title tends to be empty right after importing, and at
        // that moment the file name is the only searchable thing.
        conditions.push(
          sql`(${galleries.title} LIKE ${`%${searchTerm}%`} COLLATE NOCASE OR ${galleries.fileName} LIKE ${`%${searchTerm}%`} COLLATE NOCASE)` as SQL<boolean>,
        );
      }

      if (mediaTypes && mediaTypes.length > 0) {
        conditions.push(inArray(galleries.mediaType, mediaTypes) as SQL<boolean>);
      }

      if (favoriteFilterState === 'favorite') {
        conditions.push(eq(galleries.isFavorite, true) as SQL<boolean>);
      } else if (favoriteFilterState === 'not-favorite') {
        conditions.push(eq(galleries.isFavorite, false) as SQL<boolean>);
      }

      let query = db
        .select()
        .from(galleries)
        .where(and(...conditions))
        .$dynamic();

      const orderBy = sortDirection === 'desc' ? desc : asc;
      switch (sortBy) {
        case 'title':
          query = query.orderBy(orderBy(galleries.title));
          break;
        case 'fileName':
          query = query.orderBy(orderBy(galleries.fileName));
          break;
        case 'sizeBytes':
          query = query.orderBy(orderBy(galleries.sizeBytes));
          break;
        case 'updatedAt':
          query = query.orderBy(orderBy(galleries.updatedAt));
          break;
        case 'createdAt':
          query = query.orderBy(orderBy(galleries.createdAt));
          break;
        default:
          // Most recent first: in a gallery, what was just added is what the person wants to see.
          query = query.orderBy(desc(galleries.createdAt));
          break;
      }

      return query.all();
    },

    async getById(galleryId): Promise<GallerySelect | undefined> {
      const gallery = await db.query.galleries.findFirst({
        where: and(eq(galleries.id, galleryId), eq(galleries.isDeleted, false)),
      });
      return decorateFavorite(db, 'Gallery', gallery);
    },

    async getByHash(storyId, hash): Promise<GallerySelect | undefined> {
      return db.query.galleries.findFirst({
        where: and(
          eq(galleries.storyId, storyId),
          eq(galleries.hash, hash),
          eq(galleries.isDeleted, false),
        ),
      });
    },

    async getGalleriesForOwner(storyId, ownerId, ownerType): Promise<GallerySelect[]> {
      const links = await db
        .select({ galleryId: galleryRelations.galleryId })
        .from(galleryRelations)
        .where(
          and(
            eq(galleryRelations.storyId, storyId),
            eq(galleryRelations.ownerId, ownerId),
            eq(galleryRelations.ownerType, ownerType),
            eq(galleryRelations.isDeleted, false),
          ),
        )
        .execute();

      const galleryIds = links.map((link) => link.galleryId);
      if (galleryIds.length === 0) {
        return [];
      }

      return db
        .select()
        .from(galleries)
        .where(and(inArray(galleries.id, galleryIds), eq(galleries.isDeleted, false)))
        .orderBy(desc(galleries.createdAt))
        .all();
    },

    async createGallery(currentUserId, media): Promise<GallerySelect> {
      await assertStoryIsWritable(db, media.storyId);
      let newGallery = prepareNewEntityData<GalleryInsert>({
        storyId: media.storyId,
        mediaType: media.mediaType,
        mimeType: media.mimeType,
        fileName: media.fileName,
        hash: media.hash,
        sizeBytes: media.sizeBytes,
        sourceUrl: media.sourceUrl ?? null,
        title: media.title ?? null,
        extraNotes: media.extraNotes ?? null,
        isFavorite: media.isFavorite ?? false,
        localPath: media.localPath,
        thumbnailPath: media.thumbnailPath ?? null,
        // A link has no bytes to send; the metadata is the whole medium.
        uploadState: media.mediaType === 'link' ? 'uploaded' : 'pending',
        downloadState: 'downloaded',
      } as Create<GalleryInsert>);

      const favorite = await normalizeFavoriteCreate(db, newGallery.storyId, 'Gallery', newGallery);
      newGallery = favorite.data;

      const result = await db.insert(galleries).values(newGallery).returning().get();
      await persistInitialFavorite(
        db,
        newGallery.storyId,
        newGallery.id,
        'Gallery',
        currentUserId,
        favorite.individualFavorite,
      );

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        media.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        media.storyId,
        userIdToLog,
        'create',
        'Gallery',
        result.id,
        syncablePayload(result),
      );
      entityEventEmitter.emit('gallery_changed', media.storyId, result.id);

      return result;
    },

    async updateGallery(currentUserId, galleryId, data): Promise<void> {
      const original = await db.query.galleries.findFirst({ where: eq(galleries.id, galleryId) });
      if (!original) {
        throw new Error(`Gallery with ID ${galleryId} not found for update.`);
      }
      await assertStoryIsWritable(db, original.storyId);
      data = await normalizeFavoriteUpdate(
        db,
        original.storyId,
        galleryId,
        'Gallery',
        currentUserId,
        data,
      );

      const changes = getChangedFields(original, { ...original, ...data });
      delete changes.version;
      delete changes.updatedAt;

      if (Object.keys(changes).length === 0) {
        return;
      }

      const [updated] = await db
        .update(galleries)
        .set({ ...data, updatedAt: new Date(), version: sql`${galleries.version} + 1` })
        .where(eq(galleries.id, galleryId))
        .returning({ id: galleries.id, storyId: galleries.storyId, version: galleries.version });

      if (!updated) {
        throw new Error(`Failed to update gallery ${galleryId} or gallery not found.`);
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updated.storyId,
        currentUserId,
      );
      // Log the diff already computed above, not the raw `data` input - the input has every
      // field the caller sends, changed or not.
      await recordLocalOperation(db, updated.storyId, userIdToLog, 'update', 'Gallery', galleryId, {
        ...syncablePayload(changes),
        version: updated.version,
      });
      entityEventEmitter.emit('gallery_changed', updated.storyId, galleryId);
    },

    async updateGalleryFavoriteStatus(currentUserId, galleryId, isFavorite): Promise<void> {
      await this.updateGallery(currentUserId, galleryId, { isFavorite });
    },

    async deleteGallery(currentUserId, galleryId): Promise<void> {
      const toDelete = await db.query.galleries.findFirst({ where: eq(galleries.id, galleryId) });
      if (!toDelete) {
        console.warn(`Attempted to delete non-existent gallery ${galleryId}.`);
        return;
      }
      await assertStoryIsWritable(db, toDelete.storyId);

      const [updated] = await db
        .update(galleries)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${galleries.version} + 1`,
        })
        .where(eq(galleries.id, galleryId))
        .returning({
          id: galleries.id,
          storyId: galleries.storyId,
          isDeleted: galleries.isDeleted,
          version: galleries.version,
        });

      if (!updated) {
        throw new Error(`Failed to delete gallery ${galleryId} or gallery not found.`);
      }

      // The links to the entities go along with it: a link pointing at a deleted media file is not
      // displayable, and leaving it active would make the server refuse future operations on it because the
      // media no longer exists.
      const orphanLinks = await db.query.galleryRelations.findMany({
        where: and(
          eq(galleryRelations.galleryId, galleryId),
          eq(galleryRelations.isDeleted, false),
        ),
      });

      for (const link of orphanLinks) {
        const [updatedLink] = await db
          .update(galleryRelations)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
            version: sql`${galleryRelations.version} + 1`,
          })
          .where(eq(galleryRelations.id, link.id))
          .returning();

        if (updatedLink) {
          const linkUserId = await getUserIdForOperation(
            db,
            serverService,
            updatedLink.storyId,
            currentUserId,
          );
          await recordLocalOperation(
            db,
            updatedLink.storyId,
            linkUserId,
            'delete',
            'GalleryRelation',
            updatedLink.id,
            {
              id: updatedLink.id,
              isDeleted: true,
              version: updatedLink.version,
            },
          );
        }
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updated.storyId,
        currentUserId,
      );
      await recordLocalOperation(db, updated.storyId, userIdToLog, 'delete', 'Gallery', galleryId, {
        id: updated.id,
        isDeleted: updated.isDeleted,
        version: updated.version,
      });
      entityEventEmitter.emit('gallery_changed', updated.storyId, galleryId);
      entityEventEmitter.emit('gallery_relation_changed', updated.storyId, galleryId);
    },

    async setLocalFileState(galleryId, state): Promise<void> {
      await db.update(galleries).set(state).where(eq(galleries.id, galleryId));
    },

    async getPendingUploads(storyId): Promise<GallerySelect[]> {
      return db.query.galleries.findMany({
        where: and(
          eq(galleries.storyId, storyId),
          eq(galleries.isDeleted, false),
          inArray(galleries.uploadState, ['pending', 'failed']),
        ),
      });
    },

    async getPendingDownloads(storyId): Promise<GallerySelect[]> {
      return db.query.galleries.findMany({
        where: and(
          eq(galleries.storyId, storyId),
          eq(galleries.isDeleted, false),
          inArray(galleries.downloadState, ['pending', 'failed']),
        ),
      });
    },
  };
};

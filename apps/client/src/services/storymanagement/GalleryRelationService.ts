import type { GalleryOwnerEntity } from '@keres/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { GalleryRelationInsert, GalleryRelationSelect } from '../../db/schema';
import { galleryRelations } from '../../db/schema';
import { prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

/** An entity a media file is (or can be) linked to. */
export interface GalleryOwnerRef {
  ownerId: string;
  ownerType: GalleryOwnerEntity;
}

export interface GalleryRelationService {
  /** A media file's active links - which entities it belongs to. */
  getOwnersForGallery(storyId: string, galleryId: string): Promise<GalleryRelationSelect[]>;
  /** An entity's active links - which media files it has. */
  getRelationsForOwner(
    storyId: string,
    ownerId: string,
    ownerType: GalleryOwnerEntity,
  ): Promise<GalleryRelationSelect[]>;
  linkGalleryToOwner(
    currentUserId: string,
    storyId: string,
    galleryId: string,
    owner: GalleryOwnerRef,
  ): Promise<void>;
  unlinkGalleryFromOwner(
    currentUserId: string,
    storyId: string,
    galleryId: string,
    owner: GalleryOwnerRef,
  ): Promise<void>;
  /** Soft-deletes every active owner link when its gallery is removed. */
  unlinkAllForGallery(currentUserId: string, storyId: string, galleryId: string): Promise<number>;
  /** Reconciles a media file's owners to exactly this list. */
  setOwnersForGallery(
    currentUserId: string,
    storyId: string,
    galleryId: string,
    owners: GalleryOwnerRef[],
  ): Promise<void>;
  /** Reconciles an entity's media files to exactly this list. */
  setGalleriesForOwner(
    currentUserId: string,
    storyId: string,
    owner: GalleryOwnerRef,
    galleryIds: string[],
  ): Promise<void>;
}

export const createGalleryRelationService = (db: AppDrizzleClient): GalleryRelationService => {
  const serverService = createServerService(db);

  const ownerKey = (owner: GalleryOwnerRef) => `${owner.ownerType}:${owner.ownerId}`;

  /** Tombstones one link and records its delete; runs inside a `runLocalWrite` unit. */
  const tombstoneRelation = (storyId: string, relationId: string, userIdToLog: string): void => {
    const updated = db
      .update(galleryRelations)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
        version: sql`${galleryRelations.version} + 1`,
      })
      .where(eq(galleryRelations.id, relationId))
      .returning()
      .get();

    if (!updated) {
      throw new Error(`Failed to remove gallery relation ${relationId}.`);
    }

    recordLocalOperationSync(db, storyId, userIdToLog, 'delete', 'GalleryRelation', updated.id, {
      id: updated.id,
      isDeleted: true,
      version: updated.version,
    });
  };

  return {
    async getOwnersForGallery(storyId, galleryId): Promise<GalleryRelationSelect[]> {
      return db.query.galleryRelations.findMany({
        where: and(
          eq(galleryRelations.storyId, storyId),
          eq(galleryRelations.galleryId, galleryId),
          eq(galleryRelations.isDeleted, false),
        ),
      });
    },

    async getRelationsForOwner(storyId, ownerId, ownerType): Promise<GalleryRelationSelect[]> {
      return db.query.galleryRelations.findMany({
        where: and(
          eq(galleryRelations.storyId, storyId),
          eq(galleryRelations.ownerId, ownerId),
          eq(galleryRelations.ownerType, ownerType),
          eq(galleryRelations.isDeleted, false),
        ),
      });
    },

    async linkGalleryToOwner(currentUserId, storyId, galleryId, owner): Promise<void> {
      await assertStoryIsWritable(db, storyId);
      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      const pairIs = (isDeleted: boolean) =>
        and(
          eq(galleryRelations.storyId, storyId),
          eq(galleryRelations.galleryId, galleryId),
          eq(galleryRelations.ownerId, owner.ownerId),
          eq(galleryRelations.ownerType, owner.ownerType),
          eq(galleryRelations.isDeleted, isDeleted),
        );

      // The lookups run inside the unit: two quick links of the same pair would otherwise both
      // see "not linked yet" and write two rows for it.
      const linked = await runLocalWrite(db, storyId, () => {
        const existing = db.select().from(galleryRelations).where(pairIs(false)).get();
        if (existing) {
          return false;
        }

        // Relinking something that was unlinked reuses the row instead of creating another: the
        // server treats the (media, owner) pair as unique among the active ones, so a second row
        // for the same pair would be refused on the push.
        const tombstone = db.select().from(galleryRelations).where(pairIs(true)).get();

        if (tombstone) {
          const revived = db
            .update(galleryRelations)
            .set({
              isDeleted: false,
              deletedAt: null,
              updatedAt: new Date(),
              version: sql`${galleryRelations.version} + 1`,
            })
            .where(eq(galleryRelations.id, tombstone.id))
            .returning()
            .get();

          if (!revived) {
            throw new Error(`Failed to restore gallery relation ${tombstone.id}.`);
          }

          recordLocalOperationSync(
            db,
            storyId,
            userIdToLog,
            'update',
            'GalleryRelation',
            revived.id,
            {
              isDeleted: false,
              version: revived.version,
            },
          );
          return true;
        }

        const newRelation = prepareNewEntityData<GalleryRelationInsert>({
          storyId,
          galleryId,
          ownerId: owner.ownerId,
          ownerType: owner.ownerType,
        });

        const result = db.insert(galleryRelations).values(newRelation).returning().get();
        recordLocalOperationSync(db, storyId, userIdToLog, 'create', 'GalleryRelation', result.id, {
          ...result,
        });
        return true;
      });

      if (linked) {
        entityEventEmitter.emit('gallery_relation_changed', storyId, galleryId);
      }
    },

    async unlinkGalleryFromOwner(currentUserId, storyId, galleryId, owner): Promise<void> {
      await assertStoryIsWritable(db, storyId);
      const relation = await db.query.galleryRelations.findFirst({
        where: and(
          eq(galleryRelations.storyId, storyId),
          eq(galleryRelations.galleryId, galleryId),
          eq(galleryRelations.ownerId, owner.ownerId),
          eq(galleryRelations.ownerType, owner.ownerType),
          eq(galleryRelations.isDeleted, false),
        ),
      });

      if (!relation) {
        console.warn(
          `Gallery relation between ${galleryId} and ${owner.ownerType} ${owner.ownerId} not found or already removed.`,
        );
        return;
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      await runLocalWrite(db, storyId, () => tombstoneRelation(storyId, relation.id, userIdToLog));
      entityEventEmitter.emit('gallery_relation_changed', storyId, galleryId);
    },

    async unlinkAllForGallery(currentUserId, storyId, galleryId): Promise<number> {
      const relations = await this.getOwnersForGallery(storyId, galleryId);
      if (relations.length === 0) {
        return 0;
      }
      await assertStoryIsWritable(db, storyId);
      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      // One unit for the whole sweep: removing a gallery never leaves it half-unlinked.
      await runLocalWrite(db, storyId, () => {
        for (const relation of relations) {
          tombstoneRelation(storyId, relation.id, userIdToLog);
        }
      });
      for (let i = 0; i < relations.length; i++) {
        entityEventEmitter.emit('gallery_relation_changed', storyId, galleryId);
      }
      return relations.length;
    },

    async setOwnersForGallery(currentUserId, storyId, galleryId, owners): Promise<void> {
      const current = await this.getOwnersForGallery(storyId, galleryId);
      const currentKeys = new Set(
        current.map((relation) => `${relation.ownerType}:${relation.ownerId}`),
      );
      const desiredKeys = new Set(owners.map(ownerKey));

      for (const owner of owners) {
        if (!currentKeys.has(ownerKey(owner))) {
          await this.linkGalleryToOwner(currentUserId, storyId, galleryId, owner);
        }
      }

      for (const relation of current) {
        if (!desiredKeys.has(`${relation.ownerType}:${relation.ownerId}`)) {
          await this.unlinkGalleryFromOwner(currentUserId, storyId, galleryId, {
            ownerId: relation.ownerId,
            ownerType: relation.ownerType as GalleryOwnerEntity,
          });
        }
      }
    },

    async setGalleriesForOwner(currentUserId, storyId, owner, galleryIds): Promise<void> {
      const current = await this.getRelationsForOwner(storyId, owner.ownerId, owner.ownerType);
      const currentIds = new Set(current.map((relation) => relation.galleryId));
      const desiredIds = new Set(galleryIds);

      for (const galleryId of galleryIds) {
        if (!currentIds.has(galleryId)) {
          await this.linkGalleryToOwner(currentUserId, storyId, galleryId, owner);
        }
      }

      for (const relation of current) {
        if (!desiredIds.has(relation.galleryId)) {
          await this.unlinkGalleryFromOwner(currentUserId, storyId, relation.galleryId, owner);
        }
      }
    },
  };
};

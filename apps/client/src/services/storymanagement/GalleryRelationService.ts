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
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

/** Uma entidade à qual uma mídia está (ou pode ser) vinculada. */
export interface GalleryOwnerRef {
  ownerId: string;
  ownerType: GalleryOwnerEntity;
}

export interface GalleryRelationService {
  /** Os vínculos ativos de uma mídia — a quais entidades ela pertence. */
  getOwnersForGallery(storyId: string, galleryId: string): Promise<GalleryRelationSelect[]>;
  /** Os vínculos ativos de uma entidade — quais mídias ela tem. */
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
  /** Reconcilia os donos de uma mídia para exatamente esta lista. */
  setOwnersForGallery(
    currentUserId: string,
    storyId: string,
    galleryId: string,
    owners: GalleryOwnerRef[],
  ): Promise<void>;
  /** Reconcilia as mídias de uma entidade para exatamente esta lista. */
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
      const existing = await db.query.galleryRelations.findFirst({
        where: and(
          eq(galleryRelations.storyId, storyId),
          eq(galleryRelations.galleryId, galleryId),
          eq(galleryRelations.ownerId, owner.ownerId),
          eq(galleryRelations.ownerType, owner.ownerType),
          eq(galleryRelations.isDeleted, false),
        ),
      });

      if (existing) {
        return;
      }

      // Revincular algo que já foi desvinculado reaproveita a linha em vez de criar outra:
      // o servidor considera o par (mídia, dono) único entre os ativos, então uma segunda
      // linha para o mesmo par seria recusada no push.
      const tombstone = await db.query.galleryRelations.findFirst({
        where: and(
          eq(galleryRelations.storyId, storyId),
          eq(galleryRelations.galleryId, galleryId),
          eq(galleryRelations.ownerId, owner.ownerId),
          eq(galleryRelations.ownerType, owner.ownerType),
          eq(galleryRelations.isDeleted, true),
        ),
      });

      if (tombstone) {
        const [revived] = await db
          .update(galleryRelations)
          .set({
            isDeleted: false,
            deletedAt: null,
            updatedAt: new Date(),
            version: sql`${galleryRelations.version} + 1`,
          })
          .where(eq(galleryRelations.id, tombstone.id))
          .returning();

        if (!revived) {
          throw new Error(`Failed to restore gallery relation ${tombstone.id}.`);
        }

        const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
        await recordLocalOperation(
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
        entityEventEmitter.emit('gallery_relation_changed', storyId, galleryId);
        return;
      }

      const newRelation = prepareNewEntityData<GalleryRelationInsert>({
        storyId,
        galleryId,
        ownerId: owner.ownerId,
        ownerType: owner.ownerType,
      });

      const result = await db.insert(galleryRelations).values(newRelation).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      await recordLocalOperation(db, storyId, userIdToLog, 'create', 'GalleryRelation', result.id, {
        ...result,
      });
      entityEventEmitter.emit('gallery_relation_changed', storyId, galleryId);
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

      const [updated] = await db
        .update(galleryRelations)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${galleryRelations.version} + 1`,
        })
        .where(eq(galleryRelations.id, relation.id))
        .returning();

      if (!updated) {
        throw new Error(`Failed to remove gallery relation ${relation.id}.`);
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      await recordLocalOperation(
        db,
        storyId,
        userIdToLog,
        'delete',
        'GalleryRelation',
        updated.id,
        {
          id: updated.id,
          isDeleted: true,
          version: updated.version,
        },
      );
      entityEventEmitter.emit('gallery_relation_changed', storyId, galleryId);
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

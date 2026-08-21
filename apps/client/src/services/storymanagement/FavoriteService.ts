import { FavoriteBehavior, FavoriteEntityType } from '@keres/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import { favorites, stories } from '../../db/schema';
import { createULID } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { recordLocalOperation } from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

const FAVORITE_ENTITY_EVENTS: Partial<Record<FavoriteEntityType, string>> = {
  Story: 'story_changed',
  Character: 'character_changed',
  Chapter: 'chapter_changed',
  Location: 'location_changed',
  Scene: 'scene_changed',
  Note: 'note_changed',
  WorldRule: 'worldrule_changed',
  Item: 'item_changed',
  Gallery: 'gallery_changed',
  Tag: 'tag_changed',
};

export interface FavoriteService {
  getBehavior(storyId: string): Promise<FavoriteBehavior>;
  resolveUserId(storyId: string, localUserId: string): Promise<string>;
  decorateEntities<T extends { id: string; isFavorite: boolean }>(
    storyId: string,
    entityType: FavoriteEntityType,
    localUserId: string,
    entities: T[],
  ): Promise<T[]>;
  isFavorite(
    storyId: string,
    entityId: string,
    entityType: FavoriteEntityType,
    localUserId: string,
    globalValue: boolean,
  ): Promise<boolean>;
  getFavoriterIds(
    storyId: string,
    entityId: string,
    entityType: FavoriteEntityType,
  ): Promise<string[]>;
  setFavorite(
    storyId: string,
    entityId: string,
    entityType: FavoriteEntityType,
    localUserId: string,
    value: boolean,
  ): Promise<void>;
  migrateUserIdentity(storyId: string, fromUserId: string, toUserId: string): Promise<void>;
}

export const createFavoriteService = (db: AppDrizzleClient): FavoriteService => {
  const serverService = createServerService(db);

  const getBehavior = async (storyId: string): Promise<FavoriteBehavior> => {
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      columns: { favoriteBehavior: true },
    });
    return story?.favoriteBehavior ?? 'individual';
  };

  const resolveUserId = async (storyId: string, localUserId: string): Promise<string> => {
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      columns: { serverId: true },
    });
    if (!story?.serverId) return localUserId;
    const server = await serverService.getServerById(story.serverId);
    return server?.idUser ?? localUserId;
  };

  return {
    getBehavior,
    resolveUserId,

    async decorateEntities(storyId, entityType, localUserId, entities) {
      if (entities.length === 0 || (await getBehavior(storyId)) === 'global') return entities;
      const userId = await resolveUserId(storyId, localUserId);
      const rows = await db
        .select({ entityId: favorites.entityId })
        .from(favorites)
        .where(
          and(
            eq(favorites.storyId, storyId),
            eq(favorites.entityType, entityType),
            eq(favorites.userId, userId),
            eq(favorites.isDeleted, false),
            inArray(
              favorites.entityId,
              entities.map((entity) => entity.id),
            ),
          ),
        )
        .all();
      const favoriteIds = new Set(rows.map((row) => row.entityId));
      return entities.map((entity) => ({ ...entity, isFavorite: favoriteIds.has(entity.id) }));
    },

    async isFavorite(storyId, entityId, entityType, localUserId, globalValue) {
      if ((await getBehavior(storyId)) === 'global') return globalValue;
      const userId = await resolveUserId(storyId, localUserId);
      const row = await db.query.favorites.findFirst({
        where: and(
          eq(favorites.storyId, storyId),
          eq(favorites.entityId, entityId),
          eq(favorites.entityType, entityType),
          eq(favorites.userId, userId),
          eq(favorites.isDeleted, false),
        ),
        columns: { id: true },
      });
      return !!row;
    },

    async getFavoriterIds(storyId, entityId, entityType) {
      if ((await getBehavior(storyId)) !== 'individual_public') return [];
      const rows = await db
        .select({ userId: favorites.userId })
        .from(favorites)
        .where(
          and(
            eq(favorites.storyId, storyId),
            eq(favorites.entityId, entityId),
            eq(favorites.entityType, entityType),
            eq(favorites.isDeleted, false),
          ),
        )
        .all();
      return rows.map((row) => row.userId);
    },

    async setFavorite(storyId, entityId, entityType, localUserId, value) {
      const userId = await resolveUserId(storyId, localUserId);
      const existing = await db.query.favorites.findFirst({
        where: and(
          eq(favorites.storyId, storyId),
          eq(favorites.entityId, entityId),
          eq(favorites.entityType, entityType),
          eq(favorites.userId, userId),
        ),
      });

      if (value) {
        if (existing && !existing.isDeleted) return;
        if (existing) {
          const [restored] = await db
            .update(favorites)
            .set({
              isDeleted: false,
              deletedAt: null,
              updatedAt: new Date(),
              version: sql`${favorites.version} + 1`,
            })
            .where(eq(favorites.id, existing.id))
            .returning();
          await recordLocalOperation(db, storyId, userId, 'update', 'Favorite', existing.id, {
            isDeleted: false,
            deletedAt: null,
            version: restored.version,
          });
        } else {
          const now = new Date();
          const inserted = {
            id: createULID(),
            storyId,
            entityId,
            entityType,
            userId,
            createdAt: now,
            updatedAt: now,
            version: 1,
            isDeleted: false,
            deletedAt: null,
          };
          await db.insert(favorites).values(inserted).run();
          await recordLocalOperation(
            db,
            storyId,
            userId,
            'create',
            'Favorite',
            inserted.id,
            inserted,
          );
        }
      } else {
        if (!existing || existing.isDeleted) return;
        const [removed] = await db
          .update(favorites)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
            version: sql`${favorites.version} + 1`,
          })
          .where(eq(favorites.id, existing.id))
          .returning();
        await recordLocalOperation(db, storyId, userId, 'delete', 'Favorite', existing.id, {
          id: existing.id,
          version: removed.version,
        });
      }

      entityEventEmitter.emit('favorite_changed', storyId, entityType, entityId, userId);
      const entityEvent = FAVORITE_ENTITY_EVENTS[entityType];
      if (entityEvent) entityEventEmitter.emit(entityEvent, storyId, entityId);
    },

    async migrateUserIdentity(storyId, fromUserId, toUserId) {
      if (fromUserId === toUserId) return;
      const sourceRows = await db.query.favorites.findMany({
        where: and(eq(favorites.storyId, storyId), eq(favorites.userId, fromUserId)),
      });
      for (const source of sourceRows) {
        const target = await db.query.favorites.findFirst({
          where: and(
            eq(favorites.storyId, storyId),
            eq(favorites.entityId, source.entityId),
            eq(favorites.entityType, source.entityType),
            eq(favorites.userId, toUserId),
          ),
        });
        if (!target) {
          await db
            .update(favorites)
            .set({ userId: toUserId })
            .where(eq(favorites.id, source.id))
            .run();
        } else if (!source.isDeleted && target.isDeleted) {
          await db
            .update(favorites)
            .set({ isDeleted: false, deletedAt: null, updatedAt: new Date() })
            .where(eq(favorites.id, target.id))
            .run();
          await db.delete(favorites).where(eq(favorites.id, source.id)).run();
        } else {
          await db.delete(favorites).where(eq(favorites.id, source.id)).run();
        }
      }
    },
  };
};

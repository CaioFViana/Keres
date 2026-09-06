import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  EffectiveStoryRole,
  StoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { decodePulledReorderOperation, MAX_SYNC_PULL_BATCH } from '@keres/shared';
import { and, eq, gt, max, ne, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../../db';
import { usingSqlite } from '../../db/dialect';
import { favorites, operationLog, stories } from '../../db/schema';
import { eventManager } from '../../utils/EventManager';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { storyPermissionService } from '../StoryPermissionService';

/**
 * Read side of the API sync protocol. It authorizes access, applies operation-log visibility and
 * cursor rules (including public favourites), repairs legacy favourite history when needed, and
 * converts persisted operations into the shared wire format. It never mutates domain entities.
 */
export class SyncPullService {
  async getUpdatesForStory(
    userId: string,
    storyId: string,
    lastOperationVersion: number,
    lastPublicFavoriteVersion = 0,
  ): Promise<{
    updates: StoryUpdate[];
    publicFavorites: (typeof favorites.$inferSelect)[];
    serverMaxOperationVersion: number;
    role: EffectiveStoryRole;
  }> {
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    if (!story) throw new Error('Story not found.');

    const role = await this.getReadRole(userId, storyId, story.userId);
    if (!role) {
      throw new AppError(403, 'Unauthorized: User does not have read permission for this story.');
    }

    if (story.favoriteBehavior === 'individual_public') {
      const repairedFavorites = await this.ensurePublicFavoriteOperationLogs(storyId);
      if (repairedFavorites.count > 0) {
        logger.info('Created missing operation logs for public favorites', {
          storyId,
          count: repairedFavorites.count,
        });
        eventManager.emit(`storyUpdate:${storyId}`, {
          type: 'story_update',
          storyId,
          updates: repairedFavorites.count,
          maxOperationVersion: repairedFavorites.maxOperationVersion,
        });
      }
    }

    const operationsAfterMainCursor = await db.query.operationLog.findMany({
      where: and(
        eq(operationLog.storyId, storyId),
        gt(operationLog.operationVersion, lastOperationVersion),
      ),
      orderBy: [operationLog.operationVersion],
      limit: MAX_SYNC_PULL_BATCH,
    });
    const visibleOperations = operationsAfterMainCursor.filter(
      (operation) =>
        operation.entityType !== 'Favorite' ||
        story.favoriteBehavior === 'individual_public' ||
        operation.userId === userId,
    );

    // A separate cursor exposes favourites which predate a change to public visibility.
    const historicalPublicFavorites =
      story.favoriteBehavior === 'individual_public'
        ? await db.query.operationLog.findMany({
            where: and(
              eq(operationLog.storyId, storyId),
              eq(operationLog.entityType, 'Favorite'),
              gt(operationLog.operationVersion, lastPublicFavoriteVersion),
            ),
            orderBy: [operationLog.operationVersion],
          })
        : [];
    const operations = Array.from(
      new Map(
        [...visibleOperations, ...historicalPublicFavorites].map((operation) => [
          operation.id,
          operation,
        ]),
      ).values(),
    ).sort((left, right) => left.operationVersion - right.operationVersion);

    const updates = operations.map((operation) => this.toStoryUpdate(operation));
    const serverMaxOperationVersion = await this.getMaxOperationVersion(storyId);
    const publicFavorites =
      story.favoriteBehavior === 'individual_public'
        ? await db.query.favorites.findMany({
            where: and(eq(favorites.storyId, storyId), ne(favorites.userId, userId)),
          })
        : [];

    return { updates, publicFavorites, serverMaxOperationVersion, role };
  }

  private async getReadRole(
    userId: string,
    storyId: string,
    ownerId: string,
  ): Promise<EffectiveStoryRole | undefined> {
    if (ownerId === userId) return 'owner';
    const permission = await storyPermissionService.getUserPermissionForStory(userId, storyId);
    return permission?.permissionType === 'reader' || permission?.permissionType === 'writer'
      ? permission.permissionType
      : undefined;
  }

  /** Materialises operation history for snapshot-uploaded favourites that became public later. */
  async ensurePublicFavoriteOperationLogs(
    storyId: string,
  ): Promise<{ count: number; maxOperationVersion: number }> {
    return db.transaction(async (tx) => {
      // SQLite serialises writers itself; Postgres needs the Story lock alongside append operations.
      if (!usingSqlite) {
        await tx.execute(
          sql`select ${stories.id} from ${stories} where ${stories.id} = ${storyId} for update`,
        );
      }

      const [favoriteRows, loggedFavoriteRows, storyRow] = await Promise.all([
        tx
          .select()
          .from(favorites)
          .where(and(eq(favorites.storyId, storyId), eq(favorites.isDeleted, false))),
        tx
          .select({ entityId: operationLog.entityId })
          .from(operationLog)
          .where(
            and(
              eq(operationLog.storyId, storyId),
              eq(operationLog.entityType, 'Favorite'),
              eq(operationLog.operationType, 'create'),
            ),
          ),
        tx
          .select({ lastOperationVersion: stories.lastOperationVersion })
          .from(stories)
          .where(eq(stories.id, storyId)),
      ]);
      const loggedIds = new Set(loggedFavoriteRows.map((row) => row.entityId));
      const missingFavorites = favoriteRows.filter((favorite) => !loggedIds.has(favorite.id));
      let nextOperationVersion = storyRow.at(0)?.lastOperationVersion || 0;

      for (const favorite of missingFavorites) {
        nextOperationVersion += 1;
        await tx.insert(operationLog).values({
          id: ulid(),
          storyId,
          userId: favorite.userId,
          operationVersion: nextOperationVersion,
          operationType: 'create',
          entityType: 'Favorite',
          entityId: favorite.id,
          payload: {
            entityId: favorite.entityId,
            entityType: favorite.entityType,
            userId: favorite.userId,
          },
          entityVersion: favorite.version,
          createdAt: favorite.createdAt,
        });
      }
      if (missingFavorites.length > 0) {
        await tx
          .update(stories)
          .set({ lastOperationVersion: nextOperationVersion })
          .where(eq(stories.id, storyId));
      }
      return { count: missingFavorites.length, maxOperationVersion: nextOperationVersion };
    });
  }

  private async getMaxOperationVersion(storyId: string): Promise<number> {
    const result = await db
      .select({ maxVersion: max(operationLog.operationVersion) })
      .from(operationLog)
      .where(eq(operationLog.storyId, storyId));
    return result.at(0)?.maxVersion || 0;
  }

  private toStoryUpdate(operation: typeof operationLog.$inferSelect): StoryUpdate {
    const payload = operation.payload as Record<string, unknown>;
    const operationTime = operation.createdAt.toISOString();
    // entityVersion was added after operationVersion. Retain the old fallback for historical rows.
    const entityVersion = operation.entityVersion ?? operation.operationVersion;
    const metadata = {
      id: operation.entityId,
      version: entityVersion,
      operationVersion: operation.operationVersion,
      operationTime,
      originatingUser: operation.userId,
      operationId: operation.id,
    };

    if (operation.operationType === 'create') {
      const data: Record<string, unknown> = {
        ...payload,
        createdAt: operationTime,
        updatedAt: operationTime,
        version: entityVersion,
        isDeleted: false,
        deletedAt: null,
      };
      delete data.storyId;
      return {
        type: 'create',
        entity: operation.entityType,
        data,
        ...metadata,
      } as CreateStoryUpdate;
    }
    if (operation.operationType === 'update') {
      const changes: Record<string, unknown> = {
        ...payload,
        updatedAt: operationTime,
        version: entityVersion,
      };
      delete changes.storyId;
      return {
        type: 'update',
        entity: operation.entityType,
        changes,
        ...metadata,
      } as UpdateStoryUpdate;
    }
    if (operation.operationType === 'delete') {
      return {
        type: 'delete',
        entity: operation.entityType,
        ...metadata,
      } as DeleteStoryUpdate;
    }
    if (operation.operationType === 'reorder') {
      return decodePulledReorderOperation(operation.entityType, payload, metadata);
    }
    throw new Error(`Unknown sync operation: ${operation.operationType}/${operation.entityType}`);
  }
}

import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  EffectiveStoryRole,
  StoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { decodePulledReorderOperation, MAX_SYNC_PULL_BATCH } from '@keres/shared';
import { and, eq, gt, max, ne, or } from 'drizzle-orm';
import { db } from '../../db';
import { favorites, operationLog, stories } from '../../db/schema';
import { eventManager } from '../../utils/EventManager';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { storyPermissionService } from '../StoryPermissionService';
import {
  ensurePublicFavoriteOperationLogs,
  getFavoritesFingerprint,
  type FavoritesFingerprint,
} from './publicFavoriteRepair';

/** A log row carrying an operation type this server does not know - legacy or future. */
export class UnknownSyncOperationTypeError extends Error {
  constructor(operationType: string, entityType: string) {
    super(`Unknown sync operation: ${operationType}/${entityType}`);
  }
}

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
    clientFavorites?: FavoritesFingerprint | null,
  ): Promise<{
    updates: StoryUpdate[];
    publicFavorites: (typeof favorites.$inferSelect)[];
    serverMaxOperationVersion: number;
    role: EffectiveStoryRole;
    favoritesFingerprint: FavoritesFingerprint | undefined;
  }> {
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    // 404, not 500: a deleted story is a settled fact, not a broken server. The client
    // deactivates instead of retrying forever.
    if (!story) throw new AppError(404, 'Story not found.');

    const role = await this.getReadRole(userId, storyId, story.userId);
    if (!role) {
      throw new AppError(403, 'Unauthorized: User does not have read permission for this story.');
    }

    const publishesFavorites = story.favoriteBehavior === 'individual_public';
    // The full roster used to be re-sent (and the repair re-run) on every pull of every
    // public story - O(roster) rows per client every 30s to almost always deliver nothing
    // new. Now a one-row fingerprint decides: a match means the client's table already
    // mirrors this one, so both the repair and the snapshot are skipped. A mismatch (or a
    // client too old to send one) falls back to the old behaviour - repair first so the
    // cursors below also carry the newly materialised history, then the full roster once.
    let favoritesFingerprint: FavoritesFingerprint | undefined;
    let includeFavoritesSnapshot = false;
    if (publishesFavorites) {
      favoritesFingerprint = await getFavoritesFingerprint(storyId);
      includeFavoritesSnapshot =
        !clientFavorites ||
        clientFavorites.count !== favoritesFingerprint.count ||
        clientFavorites.maxVersion !== favoritesFingerprint.maxVersion;
      if (includeFavoritesSnapshot) {
        const repairedFavorites = await ensurePublicFavoriteOperationLogs(storyId);
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
    }

    // Visibility belongs in the query, not in a post-filter. With LIMIT-before-filter, a
    // run of MAX_SYNC_PULL_BATCH invisible favorites (someone else's, on a story keeping them
    // private) fills the whole page, the client receives an empty list, stops paging, and never
    // advances past them - a silent permanent stall, with new history piling up above a window
    // that never moves. Filtering in SQL makes every page carry visible progress, or be honestly
    // empty only at the end of history.
    const favoriteVisibility = publishesFavorites
      ? undefined
      : or(ne(operationLog.entityType, 'Favorite'), eq(operationLog.userId, userId));
    const visibleOperations = await db.query.operationLog.findMany({
      where: and(
        eq(operationLog.storyId, storyId),
        gt(operationLog.operationVersion, lastOperationVersion),
        favoriteVisibility,
      ),
      orderBy: [operationLog.operationVersion],
      limit: MAX_SYNC_PULL_BATCH,
    });

    // A separate cursor exposes favourites which predate a change to public visibility. It carries
    // the same batch ceiling as the main query: when history exceeds it, the client's cursor simply
    // continues on the next cycle instead of one pull loading the whole favourite history at once.
    const historicalPublicFavorites = publishesFavorites
      ? await db.query.operationLog.findMany({
          where: and(
            eq(operationLog.storyId, storyId),
            eq(operationLog.entityType, 'Favorite'),
            gt(operationLog.operationVersion, lastPublicFavoriteVersion),
          ),
          orderBy: [operationLog.operationVersion],
          limit: MAX_SYNC_PULL_BATCH,
        })
      : [];
    // The same row can arrive through both cursors, so the merge dedupes by id and restores
    // version order: the client applies updates in sequence and must never see one twice.
    // The merge joins two full cursors, so without the cap it can reach twice the batch size -
    // and the client advances a SINGLE max-cursor per page, which is only valid when the page
    // is prefix-closed. Favorites above the main page top would otherwise drag the cursor past
    // undelivered main rows, skipping them forever. Keeping the lowest batch restores the
    // invariant: versions are unique per story, so cut rows sort strictly above the page max
    // and the next page picks them up.
    const operations = Array.from(
      new Map(
        [...visibleOperations, ...historicalPublicFavorites].map((operation) => [
          operation.id,
          operation,
        ]),
      ).values(),
    )
      .sort((left, right) => left.operationVersion - right.operationVersion)
      .slice(0, MAX_SYNC_PULL_BATCH);

    // A single legacy/future row must not poison the whole page: an unknown operation type is
    // skipped with a warning and the rest of the page still goes out. Conversion failures for
    // *known* types still throw - a corrupt row of a kind this server understands is a bug worth
    // failing loudly on, not silent data loss.
    const updates: StoryUpdate[] = [];
    for (const operation of operations) {
      try {
        updates.push(this.toStoryUpdate(operation));
      } catch (error) {
        if (!(error instanceof UnknownSyncOperationTypeError)) throw error;
        logger.warn('SyncPullService: skipping unknown sync operation type', {
          storyId,
          operationId: operation.id,
          operationVersion: operation.operationVersion,
          operationType: operation.operationType,
          entityType: operation.entityType,
        });
      }
    }
    const serverMaxOperationVersion = await this.getMaxOperationVersion(storyId);
    const publicFavorites = includeFavoritesSnapshot
      ? await db.query.favorites.findMany({
          where: and(eq(favorites.storyId, storyId), ne(favorites.userId, userId)),
        })
      : [];

    return {
      updates,
      publicFavorites,
      serverMaxOperationVersion,
      role,
      favoritesFingerprint,
    };
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
    throw new UnknownSyncOperationTypeError(operation.operationType, operation.entityType);
  }
}

import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { CreateFavoriteDataSchema, PartialFavoriteSchema } from '@keres/shared';
import { and, count, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { favorites } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

/** Live favorites one user may keep in one story (see the create). */
export const MAX_FAVORITES_PER_USER_PER_STORY = 5000;

/**
 * Sync handler for per-user favourites. Favourites are personal metadata: readers may synchronize
 * their own rows and the entity does not consume a story-content quota, while all mutations remain
 * restricted to the row's owner.
 */
export class FavoriteSyncHandler extends BaseSyncEntityHandler<
  typeof CreateFavoriteDataSchema,
  typeof PartialFavoriteSchema
> {
  entityName = 'Favorite';
  readonly naturalKey = ['entityId', 'entityType', 'userId'] as const;
  tierLimitScope = 'none' as const;

  allowsReaderWrite(): boolean {
    return true;
  }

  protected payloadForLog(
    parsed: Record<string, unknown>,
    actingUserId: string,
  ): Record<string, unknown> {
    return { ...super.payloadForLog(parsed, actingUserId), userId: actingUserId };
  }

  constructor() {
    super('id', 'version', CreateFavoriteDataSchema, PartialFavoriteSchema, {
      storyIdColumnName: 'storyId',
      userIdColumnName: 'userId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(
    userId: string,
    storyId: string,
    update: CreateStoryUpdate,
    database: CompatibleDb = db,
  ): Promise<void> {
    const data = this.createSchema.parse(update.data);
    if (data.userId !== userId) {
      throw new SyncConflictError('unauthorized', 'A user can only create their own favorites.');
    }
    // Readers may write favorites and the target is not required to exist yet (an older client
    // pushes an initial favorite before its entity's create), so a ceiling is what keeps a reader
    // from filling the table - and every collaborator's public-favorites snapshot - with rows.
    const [{ live }] = await database
      .select({ live: count() })
      .from(favorites)
      .where(
        and(
          eq(favorites.storyId, storyId),
          eq(favorites.userId, userId),
          eq(favorites.isDeleted, false),
        ),
      );
    if (live >= MAX_FAVORITES_PER_USER_PER_STORY) {
      throw new SyncConflictError(
        'limit_exceeded',
        `A user can keep at most ${MAX_FAVORITES_PER_USER_PER_STORY} favorites in a story.`,
      );
    }
    const now = this.parseOperationTime(update.operationTime);
    await database.insert(favorites).values({
      id: update.id!,
      storyId,
      entityId: data.entityId,
      entityType: data.entityType,
      userId,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    if (currentEntity.userId !== userId) {
      throw new SyncConflictError('unauthorized', 'A user can only update their own favorites.');
    }
    const changes = { ...update.changes };
    delete changes.userId;
    delete changes.storyId;
    delete changes.entityId;
    delete changes.entityType;
    await super.update(userId, storyId, { ...update, changes }, currentEntity, database);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    if (currentEntity.userId !== userId) {
      throw new SyncConflictError('unauthorized', 'A user can only remove their own favorites.');
    }
    await super.delete(userId, storyId, update, currentEntity, database);
  }
}

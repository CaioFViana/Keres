import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate} from '@keres/shared';
import {
  CreateFavoriteDataSchema,
  PartialFavoriteSchema
} from '@keres/shared';
import { db } from '../../db';
import { favorites } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class FavoriteSyncHandler extends BaseSyncEntityHandler<
  typeof CreateFavoriteDataSchema,
  typeof PartialFavoriteSchema
> {
  entityName = 'Favorite';

  constructor() {
    super('favorites', 'id', 'version', CreateFavoriteDataSchema, PartialFavoriteSchema, {
      storyIdColumnName: 'storyId',
      userIdColumnName: 'userId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const data = this.createSchema.parse(update.data);
    if (data.userId !== userId) {
      throw new SyncConflictError('unauthorized', 'A user can only create their own favorites.');
    }
    const now = this.parseOperationTime(update.operationTime);
    await db.insert(favorites).values({
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
    currentEntity: any,
  ): Promise<void> {
    if (currentEntity.userId !== userId) {
      throw new SyncConflictError('unauthorized', 'A user can only update their own favorites.');
    }
    const changes = { ...update.changes };
    delete changes.userId;
    delete changes.storyId;
    delete changes.entityId;
    delete changes.entityType;
    await super.update(userId, storyId, { ...update, changes }, currentEntity);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    if (currentEntity.userId !== userId) {
      throw new SyncConflictError('unauthorized', 'A user can only remove their own favorites.');
    }
    await super.delete(userId, storyId, update, currentEntity);
  }
}

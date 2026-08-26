import type { CreateCommentDataType, CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { CreateCommentDataSchema, PartialCommentSchema } from '@keres/shared';
import { db } from '../../db';
import { comments } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class CommentSyncHandler extends BaseSyncEntityHandler<
  typeof CreateCommentDataSchema,
  typeof PartialCommentSchema
> {
  entityName = 'Comment';

  constructor() {
    super('comments', 'id', 'version', CreateCommentDataSchema, PartialCommentSchema, {
      storyIdColumnName: 'storyId',
      userIdColumnName: 'authorUserId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const data: CreateCommentDataType = this.createSchema.parse(update.data);
    if (data.authorUserId !== userId) {
      throw new SyncConflictError(
        'unauthorized',
        'A user can only create comments under their own identity.',
      );
    }
    // The reader/allowReaderComments gate was already applied in SyncService.processAndRecordUpdates
    // before this method was called - nothing extra to check here about it.
    const now = this.parseOperationTime(update.operationTime);
    await db.insert(comments).values({
      id: update.id!,
      storyId,
      entityType: data.entityType,
      entityId: data.entityId,
      fieldId: data.fieldId,
      fieldKey: data.fieldKey,
      contentSnapshot: data.contentSnapshot,
      excerptText: data.excerptText,
      authorUserId: userId,
      commentText: data.commentText,
      criticality: data.criticality,
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
    // Editing the text/excerpt/criticality is always restricted to the author, even for the story's owner
    // - the owner only has an elevated *deletion* privilege (see SyncService.ts), not the right to edit
    // content written by somebody else.
    if (currentEntity.authorUserId !== userId) {
      throw new SyncConflictError('unauthorized', 'Only the comment author can edit it.');
    }
    const changes = { ...update.changes };
    delete changes.storyId;
    delete changes.entityType;
    delete changes.entityId;
    delete changes.fieldId;
    delete changes.fieldKey;
    delete changes.authorUserId;
    delete changes.contentSnapshot;
    await super.update(userId, storyId, { ...update, changes }, currentEntity);
  }

  // delete() is not overridden: authorization (a story's owner can delete any comment; a writer/reader
  // only their own) is already resolved in SyncService.processAndRecordUpdates, the only place where the
  // user's `role` is available without extending the SyncEntityHandler interface just for this case.
}

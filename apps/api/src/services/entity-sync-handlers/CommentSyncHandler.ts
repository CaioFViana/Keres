import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type { CreateCommentDataType, CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { CreateCommentDataSchema, PartialCommentSchema } from '@keres/shared';
import { db } from '../../db';
import { comments } from '../../db/schema';
import {
  BaseSyncEntityHandler,
  SyncConflictError,
  type SyncEntityMutationPolicyContext,
  type SyncOperationPolicyContext,
} from './BaseSyncEntityHandler';

/**
 * Sync handler for collaborative comments. It enforces author identity for creation and edits,
 * defines when readers may write comments, and lets a story owner moderate deletion while keeping
 * comment content itself author-owned.
 */
export class CommentSyncHandler extends BaseSyncEntityHandler<
  typeof CreateCommentDataSchema,
  typeof PartialCommentSchema
> {
  entityName = 'Comment';
  tierLimitScope = 'none' as const;

  allowsReaderWrite(context: SyncOperationPolicyContext): boolean {
    return context.allowReaderComments;
  }

  assertEntityMutationAllowed(context: SyncEntityMutationPolicyContext): void {
    if (
      context.update.type === 'delete' &&
      context.role !== 'owner' &&
      context.currentEntity.authorUserId !== context.userId
    ) {
      throw new SyncConflictError(
        'unauthorized',
        'Only the comment author or the story owner can delete this comment.',
      );
    }
  }

  protected payloadForLog(parsed: Record<string, unknown>, actingUserId: string): Record<string, unknown> {
    return { ...super.payloadForLog(parsed, actingUserId), authorUserId: actingUserId };
  }

  constructor() {
    super('id', 'version', CreateCommentDataSchema, PartialCommentSchema, {
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
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
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
}

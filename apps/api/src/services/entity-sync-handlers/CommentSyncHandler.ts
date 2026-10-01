import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type { CreateCommentDataType, CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { CreateCommentDataSchema, PartialCommentSchema } from '@keres/shared';
import { db, type CompatibleDb } from '../../db';
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
  // Where a comment is anchored and who wrote it are settled at creation.
  protected fixedFields = [
    'storyId',
    'entityType',
    'entityId',
    'fieldId',
    'fieldKey',
    'authorUserId',
    'contentSnapshot',
  ] as const;

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
    // Restoring undoes a deletion, and the row does not record who deleted it: letting the author
    // restore would let them reverse the owner's moderation. Only the owner restores.
    if (
      context.update.type === 'update' &&
      context.role !== 'owner' &&
      context.currentEntity.isDeleted &&
      (context.update as UpdateStoryUpdate).changes?.isDeleted === false
    ) {
      throw new SyncConflictError(
        'unauthorized',
        'Only the story owner can restore a deleted comment.',
      );
    }
  }

  protected payloadForLog(
    parsed: Record<string, unknown>,
    actingUserId: string,
  ): Record<string, unknown> {
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

  async create(
    userId: string,
    storyId: string,
    update: CreateStoryUpdate,
    database: CompatibleDb = db,
  ): Promise<void> {
    const data: CreateCommentDataType = this.createSchema.parse(update.data);
    if (data.authorUserId !== userId) {
      throw new SyncConflictError(
        'unauthorized',
        'A user can only create comments under their own identity.',
      );
    }
    // Polymorphic, so no foreign key holds it to this story.
    await this.assertEntityInStory(data.entityType, data.entityId, storyId, database);
    const now = this.parseOperationTime(update.operationTime);
    await database.insert(comments).values({
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
    database: CompatibleDb = db,
  ): Promise<void> {
    // Editing the text/excerpt/criticality is always restricted to the author, even for the story's owner
    // - the owner only has an elevated *deletion* privilege (see SyncService.ts), not the right to edit
    // content written by somebody else.
    if (currentEntity.authorUserId !== userId) {
      throw new SyncConflictError('unauthorized', 'Only the comment author can edit it.');
    }
    await super.update(userId, storyId, update, currentEntity, database);
  }
}

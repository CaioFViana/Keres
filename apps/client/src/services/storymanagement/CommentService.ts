import type { CommentEntityType } from '@keres/shared';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient, CommentSelect} from '../../db';
import { comments } from '../../db';
import { createULID } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import i18n from '../../utils/i18n';
import {
  getUserIdForOperation,
  recordLocalOperation,
  StoryReadOnlyError,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export type CommentTarget =
  | { fieldKey: string; fieldId?: never }
  | { fieldId: string; fieldKey?: never };

export interface CreateCommentInput {
  contentSnapshot: string | null;
  excerptText: string | null;
  commentText: string;
  criticality: number;
}

export interface CommentService {
  getCommentsForEntity(
    storyId: string,
    entityType: CommentEntityType,
    entityId: string,
  ): Promise<CommentSelect[]>;
  getAllCommentsForStory(
    storyId: string,
    opts: { page: number; pageSize: number },
  ): Promise<{ items: CommentSelect[]; total: number }>;
  createComment(
    currentUserId: string,
    storyId: string,
    entityType: CommentEntityType,
    entityId: string,
    target: CommentTarget,
    input: CreateCommentInput,
  ): Promise<CommentSelect>;
  updateComment(
    currentUserId: string,
    commentId: string,
    changes: { commentText?: string; excerptText?: string | null; criticality?: number },
  ): Promise<CommentSelect>;
  deleteComment(currentUserId: string, commentId: string, isStoryOwner: boolean): Promise<boolean>;
  migrateAuthorIdentity(storyId: string, fromUserId: string, toUserId: string): Promise<void>;
}

export const createCommentService = (db: AppDrizzleClient): CommentService => {
  const serverService = createServerService(db);

  /**
   * Mesma checagem "falha rápido antes do reload de sync" de `assertStoryIsWritable`, mas com
   * a exceção de `allowReaderComments`: um leitor pode escrever Comments se a história (só
   * relevante quando vinculada a servidor) permitir. `assertStoryIsWritable` não serve aqui
   * porque é fixo em owner/writer, sem essa exceção por entidade (mesmo motivo por que
   * FavoriteService também não a usa).
   */
  const assertCanWriteComment = async (storyId: string): Promise<void> => {
    const story = await db.query.stories.findFirst({
      where: (stories, { eq }) => eq(stories.id, storyId),
      columns: { myRole: true, serverId: true, allowReaderComments: true },
    });
    if (
      story?.serverId &&
      story.myRole !== 'owner' &&
      story.myRole !== 'writer' &&
      !(story.myRole === 'reader' && story.allowReaderComments)
    ) {
      throw new StoryReadOnlyError(i18n.t('story_read_only_error'));
    }
  };

  return {
    async getCommentsForEntity(storyId, entityType, entityId) {
      return db
        .select()
        .from(comments)
        .where(
          and(
            eq(comments.storyId, storyId),
            eq(comments.entityType, entityType),
            eq(comments.entityId, entityId),
            eq(comments.isDeleted, false),
          ),
        )
        .all();
    },

    async getAllCommentsForStory(storyId, { page, pageSize }) {
      const where = and(eq(comments.storyId, storyId), eq(comments.isDeleted, false));
      const [{ value: total }] = await db.select({ value: count() }).from(comments).where(where);
      const items = await db
        .select()
        .from(comments)
        .where(where)
        .orderBy(desc(comments.createdAt))
        .limit(pageSize)
        .offset(page * pageSize)
        .all();
      return { items, total };
    },

    async createComment(currentUserId, storyId, entityType, entityId, target, input) {
      await assertCanWriteComment(storyId);

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      const now = new Date();
      const inserted = {
        id: createULID(),
        storyId,
        entityType,
        entityId,
        fieldId: target.fieldId ?? null,
        fieldKey: target.fieldKey ?? null,
        contentSnapshot: input.contentSnapshot,
        excerptText: input.excerptText,
        authorUserId: userIdToLog,
        commentText: input.commentText,
        criticality: input.criticality,
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      };
      await db.insert(comments).values(inserted).run();
      await recordLocalOperation(
        db,
        storyId,
        userIdToLog,
        'create',
        'Comment',
        inserted.id,
        inserted,
      );
      entityEventEmitter.emit('comment_changed', storyId, entityType, entityId);
      return inserted;
    },

    async updateComment(currentUserId, commentId, changes) {
      const existing = await db.query.comments.findFirst({ where: eq(comments.id, commentId) });
      if (!existing || existing.isDeleted) {
        throw new Error('Comment not found.');
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        existing.storyId,
        currentUserId,
      );
      if (existing.authorUserId !== userIdToLog) {
        throw new Error('Only the comment author can edit it.');
      }

      const [updated] = await db
        .update(comments)
        .set({ ...changes, updatedAt: new Date(), version: sql`${comments.version} + 1` })
        .where(eq(comments.id, commentId))
        .returning();

      await recordLocalOperation(
        db,
        existing.storyId,
        userIdToLog,
        'update',
        'Comment',
        commentId,
        {
          ...changes,
          version: updated.version,
        },
      );
      entityEventEmitter.emit(
        'comment_changed',
        existing.storyId,
        existing.entityType,
        existing.entityId,
      );
      return updated;
    },

    async deleteComment(currentUserId, commentId, isStoryOwner) {
      const existing = await db.query.comments.findFirst({ where: eq(comments.id, commentId) });
      if (!existing || existing.isDeleted) {
        return false;
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        existing.storyId,
        currentUserId,
      );
      // Dono da história pode excluir qualquer comentário (moderação); escritor/leitor só o
      // próprio - mesma regra aplicada no servidor (ver SyncService.ts/processAndRecordUpdates).
      if (!isStoryOwner && existing.authorUserId !== userIdToLog) {
        throw new Error('Only the comment author or the story owner can delete this comment.');
      }

      const [removed] = await db
        .update(comments)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${comments.version} + 1`,
        })
        .where(eq(comments.id, commentId))
        .returning({ id: comments.id, version: comments.version });

      if (!removed) {
        throw new Error(`Failed to delete Comment ${commentId}.`);
      }

      await recordLocalOperation(
        db,
        existing.storyId,
        userIdToLog,
        'delete',
        'Comment',
        commentId,
        {
          id: commentId,
          isDeleted: true,
          version: removed.version,
        },
      );
      entityEventEmitter.emit(
        'comment_changed',
        existing.storyId,
        existing.entityType,
        existing.entityId,
      );
      return true;
    },

    async migrateAuthorIdentity(storyId, fromUserId, toUserId) {
      if (fromUserId === toUserId) return;
      await db
        .update(comments)
        .set({ authorUserId: toUserId })
        .where(and(eq(comments.storyId, storyId), eq(comments.authorUserId, fromUserId)))
        .run();
    },
  };
};

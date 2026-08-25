import type { CommentEntityType } from '@keres/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type { CommentSelect } from '../db/schema';
import type { CommentTarget, CreateCommentInput } from '../services/storymanagement/CommentService';
import { createCommentService } from '../services/storymanagement/CommentService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useStoryRole } from './useStoryRole';

/**
 * Comentários de uma entidade, buscados uma vez por tela (não por campo) e agrupados por
 * `fieldKey`/`fieldId` para lookup O(1) em cada `CommentableDetailField` - evitar N queries
 * redundantes por tela (um DetailField típico tem 10+ campos).
 *
 * Também resolve se o usuário atual pode comentar: sempre para owner/writer; para reader,
 * só se a história permitir (`stories.allowReaderComments`, só relevante quando vinculada a
 * um servidor - ver plano de implementação/StorySettingsScreen).
 */
export function useEntityComments(
  storyId: string | undefined,
  entityType: CommentEntityType,
  entityId: string | undefined,
) {
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { role } = useStoryRole(storyId);

  const service = useMemo(() => (drizzleDb ? createCommentService(drizzleDb) : null), [drizzleDb]);

  const [comments, setComments] = useState<CommentSelect[]>([]);
  const [allowReaderComments, setAllowReaderComments] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!service || !drizzleDb || !storyId || !entityId) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [rows, story] = await Promise.all([
        service.getCommentsForEntity(storyId, entityType, entityId),
        drizzleDb.query.stories.findFirst({
          where: (stories, { eq }) => eq(stories.id, storyId),
          columns: { allowReaderComments: true },
        }),
      ]);
      setComments(rows);
      setAllowReaderComments(!!story?.allowReaderComments);
    } catch (error) {
      console.error(`Failed to load comments for ${entityType} ${entityId}:`, error);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [service, drizzleDb, storyId, entityType, entityId]);

  useEffect(() => {
    refresh();
    const handleChange = (
      changedStoryId: string,
      changedEntityType?: CommentEntityType,
      changedEntityId?: string,
    ) => {
      if (
        changedStoryId === storyId &&
        (!changedEntityType || (changedEntityType === entityType && changedEntityId === entityId))
      ) {
        refresh();
      }
    };
    entityEventEmitter.on('comment_changed', handleChange);
    return () => {
      entityEventEmitter.off('comment_changed', handleChange);
    };
  }, [refresh, storyId, entityType, entityId]);

  const commentsByField = useMemo(() => {
    const map: Record<string, CommentSelect[]> = {};
    for (const comment of comments) {
      const key = comment.fieldKey ?? comment.fieldId!;
      (map[key] ??= []).push(comment);
    }
    return map;
  }, [comments]);

  const isStoryOwner = role === 'owner';
  const canComment =
    role === 'owner' || role === 'writer' || (role === 'reader' && allowReaderComments);

  const addComment = useCallback(
    async (target: CommentTarget, input: CreateCommentInput) => {
      if (!service || !storyId || !userId || !entityId) return;
      await service.createComment(userId, storyId, entityType, entityId, target, input);
    },
    [service, storyId, userId, entityType, entityId],
  );

  const updateComment = useCallback(
    async (
      commentId: string,
      changes: { commentText?: string; excerptText?: string | null; criticality?: number },
    ) => {
      if (!service || !userId) return;
      await service.updateComment(userId, commentId, changes);
    },
    [service, userId],
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!service || !userId) return;
      await service.deleteComment(userId, commentId, isStoryOwner);
    },
    [service, userId, isStoryOwner],
  );

  return {
    comments,
    commentsByField,
    loading,
    canComment,
    isStoryOwner,
    currentUserId: userId,
    addComment,
    updateComment,
    deleteComment,
    refresh,
  };
}

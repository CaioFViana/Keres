import type { CommentEntityType } from '@keres/shared';
import { useCallback, useEffect, useMemo } from 'react';
import type { CommentSelect } from '../db/schema';
import type {
  CommentService,
  CommentTarget,
  CreateCommentInput,
} from '../services/storymanagement/CommentService';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useCommentSurface } from './useCommentSurface';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';

/**
 * An entity's comments, fetched once per screen (not per field) and grouped by
 * `fieldKey`/`fieldId` for O(1) lookup in each `CommentableDetailField` - to avoid N redundant
 * queries per screen (a typical DetailField has 10+ fields).
 *
 * It also resolves whether the current user may comment: always for owner/writer; for a reader,
 * only if the story allows it (`stories.allowReaderComments`, only relevant when linked to
 * a server - see the implementation plan/StorySettingsScreen).
 */
export function useEntityComments(
  storyId: string | undefined,
  entityType: CommentEntityType,
  entityId: string | undefined,
) {
  const fetchRows = useCallback(
    (service: CommentService, forStoryId: string, forEntityId: string) =>
      service.getCommentsForEntity(forStoryId, entityType, forEntityId),
    [entityType],
  );
  const {
    service,
    userId,
    comments,
    loading,
    refresh,
    isStoryOwner,
    canComment,
    updateComment,
    deleteComment,
  } = useCommentSurface(
    storyId,
    entityId,
    fetchRows,
    `Failed to load comments for ${entityType} ${entityId}:`,
  );

  useEntityInitialLoad(refresh);

  useEffect(() => {
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

  const addComment = useCallback(
    async (target: CommentTarget, input: CreateCommentInput) => {
      if (!service || !storyId || !userId || !entityId) return;
      await service.createComment(userId, storyId, entityType, entityId, target, input);
    },
    [service, storyId, userId, entityType, entityId],
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

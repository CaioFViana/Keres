import { useCallback, useEffect, useMemo } from 'react';
import type { CommentSelect } from '@/src/db/schema';
import { SCENE_BODY_DRAFT_FIELD } from '@/src/services/drafts/EditorDraftService';
import type {
  CommentService,
  CreateCommentInput,
} from '@/src/services/storymanagement/notes-tags-comments/CommentService';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';
import { useCommentSurface } from '@/src/hooks/comments/useCommentSurface';
import { useEntityInitialLoad } from '@/src/hooks/lists/useEntityRefreshLifecycle';

/**
 * Body comments for every scene on a reading surface (the manuscript), fetched with
 * one query and grouped by scene id - the bulk sibling of `useEntityComments`.
 * Only the `body` field: the manuscript surfaces prose, and body threads are the
 * same ones the scene editor reads and writes, so both stay in sync for free.
 * Writes reuse the same service methods as every other surface.
 *
 * `sceneIds` must be referentially stable (memoized by the caller): a new array
 * identity refetches.
 */
export function useSceneBodyComments(storyId: string | undefined, sceneIds: string[]) {
  const fetchRows = useCallback(
    async (service: CommentService, forStoryId: string, ids: string[]) =>
      (await service.getCommentsForEntities(forStoryId, 'Scene', ids)).filter(
        (row) => row.fieldKey === SCENE_BODY_DRAFT_FIELD,
      ),
    [],
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
    sceneIds.length > 0 ? sceneIds : null,
    fetchRows,
    `Failed to load scene body comments for story ${storyId}:`,
  );

  useEntityInitialLoad(refresh);

  useEffect(() => {
    const handleChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) refresh();
    };
    entityEventEmitter.on('comment_changed', handleChange);
    return () => {
      entityEventEmitter.off('comment_changed', handleChange);
    };
  }, [refresh, storyId]);

  const commentsBySceneId = useMemo(() => {
    const map: Record<string, CommentSelect[]> = {};
    for (const comment of comments) {
      (map[comment.entityId] ??= []).push(comment);
    }
    return map;
  }, [comments]);

  const addComment = useCallback(
    async (sceneId: string, input: CreateCommentInput) => {
      if (!service || !storyId || !userId) return;
      await service.createComment(
        userId,
        storyId,
        'Scene',
        sceneId,
        { fieldKey: SCENE_BODY_DRAFT_FIELD },
        input,
      );
    },
    [service, storyId, userId],
  );

  return {
    commentsBySceneId,
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

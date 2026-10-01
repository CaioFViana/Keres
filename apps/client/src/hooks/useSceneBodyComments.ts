import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type { CommentSelect } from '../db/schema';
import { SCENE_BODY_DRAFT_FIELD } from '../services/EditorDraftService';
import type { CreateCommentInput } from '../services/storymanagement/CommentService';
import { createCommentService } from '../services/storymanagement/CommentService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';
import { useStoryRole } from './useStoryRole';

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
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { role } = useStoryRole(storyId);

  const service = useMemo(() => (drizzleDb ? createCommentService(drizzleDb) : null), [drizzleDb]);

  const [comments, setComments] = useState<CommentSelect[]>([]);
  const [allowReaderComments, setAllowReaderComments] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!service || !drizzleDb || !storyId || sceneIds.length === 0) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [rows, story] = await Promise.all([
        service.getCommentsForEntities(storyId, 'Scene', sceneIds),
        drizzleDb.query.stories.findFirst({
          where: (stories, { eq }) => eq(stories.id, storyId),
          columns: { allowReaderComments: true },
        }),
      ]);
      setComments(rows.filter((row) => row.fieldKey === SCENE_BODY_DRAFT_FIELD));
      setAllowReaderComments(!!story?.allowReaderComments);
    } catch (error) {
      console.error(`Failed to load scene body comments for story ${storyId}:`, error);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [service, drizzleDb, storyId, sceneIds]);

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

  const isStoryOwner = role === 'owner';
  const canComment =
    role === 'owner' || role === 'writer' || (role === 'reader' && allowReaderComments);

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

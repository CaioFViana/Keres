import { useCallback, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type { CommentSelect } from '../db/schema';
import type { CommentService } from '../services/storymanagement/CommentService';
import { createCommentService } from '../services/storymanagement/CommentService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useStoryRole } from './useStoryRole';

/**
 * Internal to `useEntityComments` and `useSceneBodyComments`: the plumbing both comment surfaces
 * share - the service, the viewer's role and whether they may comment, the loaded rows, and the
 * edit/delete writes. Each surface keeps its own event subscription, its own add and its own
 * grouping, because those are what differ between them.
 *
 * `target` is what the rows are loaded for; a falsy target means there is nothing to load.
 */
export function useCommentSurface<TTarget>(
  storyId: string | undefined,
  target: TTarget | null | undefined,
  fetchRows: (
    service: CommentService,
    storyId: string,
    target: TTarget,
  ) => Promise<CommentSelect[]>,
  loadFailure: string,
) {
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { role } = useStoryRole(storyId);

  const service = useMemo(() => (drizzleDb ? createCommentService(drizzleDb) : null), [drizzleDb]);

  const [comments, setComments] = useState<CommentSelect[]>([]);
  const [allowReaderComments, setAllowReaderComments] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!service || !drizzleDb || !storyId || !target) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [rows, story] = await Promise.all([
        fetchRows(service, storyId, target),
        drizzleDb.query.stories.findFirst({
          where: (stories, { eq }) => eq(stories.id, storyId),
          columns: { allowReaderComments: true },
        }),
      ]);
      setComments(rows);
      setAllowReaderComments(!!story?.allowReaderComments);
    } catch (error) {
      console.error(loadFailure, error);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [service, drizzleDb, storyId, target, fetchRows, loadFailure]);

  const isStoryOwner = role === 'owner';
  const canComment =
    role === 'owner' || role === 'writer' || (role === 'reader' && allowReaderComments);

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
    service,
    userId,
    comments,
    loading,
    refresh,
    isStoryOwner,
    canComment,
    updateComment,
    deleteComment,
  };
}

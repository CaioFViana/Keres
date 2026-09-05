import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type { CommentSelect } from '../db/schema';
import { createCommentService } from '../services/storymanagement/CommentService';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';

/** Paginated story-wide comment list. Search stays with the caller. */
export function useStoryComments(storyId: string, pageSize = 20) {
  const drizzleDb = useDrizzle();
  const commentService = useMemo(() => createCommentService(drizzleDb), [drizzleDb]);
  const [comments, setComments] = useState<CommentSelect[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const result = await commentService.getAllCommentsForStory(storyId, {
          page: targetPage,
          pageSize,
        });
        setComments((current) => (targetPage === 0 ? result.items : [...current, ...result.items]));
        setTotal(result.total);
      } catch (error) {
        console.error('Failed to load comments:', error);
      } finally {
        setLoading(false);
      }
    },
    [commentService, pageSize, storyId],
  );

  const loadFirstPage = useCallback(() => {
    setPage(0);
    void fetchComments(0);
  }, [fetchComments]);

  useEntityInitialLoad(loadFirstPage);

  useEffect(() => {
    const handleChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) {
        setPage(0);
        fetchComments(0);
      }
    };
    entityEventEmitter.on('comment_changed', handleChange);
    return () => {
      entityEventEmitter.off('comment_changed', handleChange);
    };
  }, [fetchComments, storyId]);

  const loadMore = useCallback(() => {
    if (!loading && comments.length < total) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchComments(nextPage);
    }
  }, [comments.length, fetchComments, loading, page, total]);

  return { comments, loading, loadMore };
}

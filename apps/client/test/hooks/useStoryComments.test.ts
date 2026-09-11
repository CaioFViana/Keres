const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/services/storymanagement/CommentService', () => ({
  __esModule: true,
  createCommentService: jest.fn(),
}));
jest.mock('../../src/hooks/useEntityRefreshLifecycle', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useEntityInitialLoad: (load: () => void) =>
      React.useEffect(() => {
        load();
      }, [load]),
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useStoryComments } from '../../src/hooks/useStoryComments';
import { createCommentService } from '../../src/services/storymanagement/CommentService';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const getAllCommentsForStory = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  getAllCommentsForStory.mockImplementation(async (_storyId: string, { page }: { page: number }) =>
    page === 0
      ? { items: [{ id: 'comment-1' }, { id: 'comment-2' }], total: 3 }
      : { items: [{ id: 'comment-3' }], total: 3 },
  );
  (createCommentService as jest.Mock).mockReturnValue({ getAllCommentsForStory });
});

describe('useStoryComments', () => {
  it('loads the first page, appends later pages, and stops at the known total', async () => {
    const view = await renderHook(() => useStoryComments('story', 2));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.comments.map((comment) => comment.id)).toEqual([
      'comment-1',
      'comment-2',
    ]);

    await act(async () => view.result.current.loadMore());
    await waitFor(() => expect(view.result.current.comments).toHaveLength(3));
    await act(async () => view.result.current.loadMore());
    expect(getAllCommentsForStory).toHaveBeenCalledTimes(2);
  });

  it('restarts from page zero when comments for this story change', async () => {
    const view = await renderHook(() => useStoryComments('story'));
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    await act(async () => entityEventEmitter.emit('comment_changed', 'other-story'));
    expect(getAllCommentsForStory).toHaveBeenCalledTimes(1);
    await act(async () => entityEventEmitter.emit('comment_changed', 'story'));
    await waitFor(() => expect(getAllCommentsForStory).toHaveBeenCalledTimes(2));
    expect(getAllCommentsForStory).toHaveBeenLastCalledWith('story', { page: 0, pageSize: 20 });
  });
});

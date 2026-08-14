/** @jest-environment node */
jest.mock('../../src/db', () => ({ useDrizzle: jest.fn() }));
jest.mock('../../src/state/userSettingsStore', () => ({ useUserSettingsStore: jest.fn() }));
jest.mock('../../src/hooks/useStoryRole', () => ({ useStoryRole: jest.fn() }));
jest.mock('../../src/services/storymanagement/CommentService', () => ({
  createCommentService: jest.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useEntityComments } from '../../src/hooks/useEntityComments';
import { createCommentService } from '../../src/services/storymanagement/CommentService';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';
import { useStoryRole } from '../../src/hooks/useStoryRole';

const service = {
  getCommentsForEntity: jest.fn(),
  createComment: jest.fn(),
  updateComment: jest.fn(),
  deleteComment: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (useDrizzle as jest.Mock).mockReturnValue({
    query: { stories: { findFirst: jest.fn().mockResolvedValue({ allowReaderComments: true }) } },
  });
  (useUserSettingsStore as unknown as jest.Mock).mockReturnValue({ userId: 'user' });
  (useStoryRole as jest.Mock).mockReturnValue({ role: 'reader' });
  (createCommentService as jest.Mock).mockReturnValue(service);
  service.getCommentsForEntity.mockResolvedValue([
    { id: 'c1', fieldKey: 'title' },
    { id: 'c2', fieldKey: 'title' },
  ]);
});

it('groups entity comments by field and grants a permitted reader comment access', async () => {
  const { result } = await renderHook(() =>
    useEntityComments('story', 'Character' as never, 'character'),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.commentsByField.title).toHaveLength(2);
  expect(result.current.canComment).toBe(true);
});

it('delegates comment mutations with the current user and reader ownership flag', async () => {
  const { result } = await renderHook(() =>
    useEntityComments('story', 'Character' as never, 'character'),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () =>
    result.current.addComment({ fieldKey: 'title' } as never, {
      contentSnapshot: null,
      excerptText: null,
      commentText: 'Oi',
      criticality: 1,
    }),
  );
  await act(async () => result.current.updateComment('c1', { commentText: 'Novo' }));
  await act(async () => result.current.deleteComment('c1'));
  expect(service.createComment).toHaveBeenCalledWith(
    'user',
    'story',
    'Character',
    'character',
    { fieldKey: 'title' },
    { contentSnapshot: null, excerptText: null, commentText: 'Oi', criticality: 1 },
  );
  expect(service.updateComment).toHaveBeenCalledWith('user', 'c1', { commentText: 'Novo' });
  expect(service.deleteComment).toHaveBeenCalledWith('user', 'c1', false);
});

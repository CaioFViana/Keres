/** @jest-environment node */
jest.mock('../../src/db', () => ({ useDrizzle: jest.fn() }));
jest.mock('../../src/state/userSettingsStore', () => ({ useUserSettingsStore: jest.fn() }));
jest.mock('../../src/hooks/useStoryRole', () => ({ useStoryRole: jest.fn() }));
jest.mock('../../src/services/storymanagement/CommentService', () => ({
  createCommentService: jest.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useStoryRole } from '../../src/hooks/useStoryRole';
import { useSceneBodyComments } from '../../src/hooks/useSceneBodyComments';
import { createCommentService } from '../../src/services/storymanagement/CommentService';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';

const service = {
  getCommentsForEntities: jest.fn(),
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
  service.getCommentsForEntities.mockResolvedValue([
    { id: 'c1', entityId: 's-1', fieldKey: 'body' },
    { id: 'c2', entityId: 's-1', fieldKey: 'summary' },
    { id: 'c3', entityId: 's-2', fieldKey: 'body' },
  ]);
});

const TWO_SCENES = ['s-1', 's-2'];
const ONE_SCENE = ['s-1'];

it('groups body comments by scene and drops other fields', async () => {
  const { result } = await renderHook(() => useSceneBodyComments('story', TWO_SCENES));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(service.getCommentsForEntities).toHaveBeenCalledWith('story', 'Scene', ['s-1', 's-2']);
  expect(Object.keys(result.current.commentsBySceneId).sort()).toEqual(['s-1', 's-2']);
  expect(result.current.commentsBySceneId['s-1'].map((comment) => comment.id)).toEqual(['c1']);
  expect(result.current.canComment).toBe(true);
});

it('creates body comments on the target scene', async () => {
  const { result } = await renderHook(() => useSceneBodyComments('story', ONE_SCENE));

  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () =>
    result.current.addComment('s-2', {
      contentSnapshot: 'body',
      excerptText: null,
      commentText: 'Oi',
      criticality: 1,
    }),
  );

  expect(service.createComment).toHaveBeenCalledWith(
    'user',
    'story',
    'Scene',
    's-2',
    { fieldKey: 'body' },
    { contentSnapshot: 'body', excerptText: null, commentText: 'Oi', criticality: 1 },
  );
});

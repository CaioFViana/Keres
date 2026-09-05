/** @jest-environment node */
import { createCommentFieldBindings } from '../../src/components/features/comments/CommentableDetailField/createCommentFieldBindings';

it('uses the displayed text as the snapshot and preserves field permissions and mention origin', async () => {
  const addComment = jest.fn(async () => {});
  const bind = createCommentFieldBindings({
    storyId: 'story',
    mentionSourceId: 'item',
    canComment: false,
    isStoryOwner: false,
    currentUserId: 'reader',
    commentsByField: {},
    addComment,
    onDeleteComment: jest.fn(),
    onUpdateComment: jest.fn(),
  });
  const field = bind('description', 'Not available');
  await field.onAddComment({ commentText: 'Review this', excerptText: null, criticality: 1 });
  expect(addComment).toHaveBeenCalledWith(
    { fieldKey: 'description' },
    {
      commentText: 'Review this',
      excerptText: null,
      criticality: 1,
      contentSnapshot: 'Not available',
    },
  );
  expect(field).toMatchObject({
    value: 'Not available',
    mentionSourceId: 'item',
    canComment: false,
    comments: [],
  });
});

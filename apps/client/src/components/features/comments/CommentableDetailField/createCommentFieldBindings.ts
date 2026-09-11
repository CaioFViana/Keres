import type React from 'react';
import type { useEntityComments } from '@/src/hooks/useEntityComments';
import type CommentableDetailField from './CommentableDetailField';

type FieldProps = React.ComponentProps<typeof CommentableDetailField>;
type Bindings = Pick<
  FieldProps,
  | 'storyId'
  | 'mentionSourceId'
  | 'canComment'
  | 'isStoryOwner'
  | 'currentUserId'
  | 'onDeleteComment'
  | 'onUpdateComment'
> &
  Pick<ReturnType<typeof useEntityComments>, 'commentsByField' | 'addComment'>;

/** Bind the displayed value and its snapshot together; no queries or hidden entity context. */
export function createCommentFieldBindings({ commentsByField, addComment, ...common }: Bindings) {
  return (fieldKey: string, value: string): Omit<FieldProps, 'label'> => ({
    ...common,
    value,
    comments: commentsByField[fieldKey] ?? [],
    onAddComment: (input) => addComment({ fieldKey }, { ...input, contentSnapshot: value }),
  });
}

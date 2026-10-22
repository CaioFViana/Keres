/**
 * `invalid_format` is a file that is not a story package; `corrupt_content` is one that *is* -
 * every row valid on its own - but whose rows contradict each other: a duplicated relation, a
 * reference to an entity the file does not carry. The distinction matters to the user, who can do
 * nothing about the first and can go fix the second in the story it came from.
 */
export type StoryImportErrorReason =
  | 'unreadable'
  | 'invalid_format'
  | 'corrupt_content'
  | 'future_format_version';

/**
 * A story import error with a cause the user can understand and act on.
 *
 * In its own file because both `storyTransfer.ts` (reading a `.json`) and
 * `storyMediaBundle.ts` (reading a `.zip`) need to throw it, and neither of the two should
 * depend on the other just because of this type.
 */
export class StoryImportError extends Error {
  readonly reason: StoryImportErrorReason;

  constructor(reason: StoryImportErrorReason, message: string) {
    super(message);
    this.name = 'StoryImportError';
    this.reason = reason;
  }
}

/** The message the person is shown for a story package that could not be imported, by the reason it was refused. */
export function storyImportMessageKey(reason: string): string {
  switch (reason) {
    case 'future_format_version':
      return 'import_story_future_version';
    case 'invalid_format':
      return 'import_story_invalid_file';
    case 'corrupt_content':
      return 'import_story_corrupt_content';
    default:
      return 'import_story_unreadable_file';
  }
}

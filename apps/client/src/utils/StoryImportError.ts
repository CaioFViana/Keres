/**
 * A story import error with a cause the user can understand and act on.
 *
 * In its own file because both `storyTransfer.ts` (reading a `.json`) and
 * `storyMediaBundle.ts` (reading a `.zip`) need to throw it, and neither of the two should
 * depend on the other just because of this type.
 */
export class StoryImportError extends Error {
  readonly reason: 'unreadable' | 'invalid_format' | 'future_format_version';

  constructor(reason: 'unreadable' | 'invalid_format' | 'future_format_version', message: string) {
    super(message);
    this.name = 'StoryImportError';
    this.reason = reason;
  }
}

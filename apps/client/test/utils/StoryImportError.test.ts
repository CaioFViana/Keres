import { StoryImportError } from '../../src/utils/StoryImportError';

describe('StoryImportError', () => {
  it.each(['unreadable', 'invalid_format', 'future_format_version'] as const)(
    'carries the %s reason the import screen switches on',
    (reason) => {
      const error = new StoryImportError(reason, 'falhou');

      expect(error.reason).toBe(reason);
      expect(error.message).toBe('falhou');
    },
  );

  it('is a real Error, so a catch block can rethrow it with its stack intact', () => {
    const error = new StoryImportError('unreadable', 'arquivo ilegível');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(StoryImportError);
    expect(error.name).toBe('StoryImportError');
    expect(error.stack).toBeDefined();
  });

  it('stays distinguishable from an unexpected failure during import', () => {
    expect(new Error('boom')).not.toBeInstanceOf(StoryImportError);
  });
});

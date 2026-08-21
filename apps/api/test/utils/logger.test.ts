import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../src/utils/logger';

function captureLine(channel: 'log' | 'warn' | 'error', emit: () => void): Record<string, any> {
  const spy = vi.spyOn(console, channel).mockImplementation(() => {});
  emit();
  expect(spy).toHaveBeenCalledTimes(1);
  return JSON.parse(spy.mock.calls[0][0] as string);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger', () => {
  it.each([
    ['info', 'log'],
    ['warn', 'warn'],
    ['error', 'error'],
  ] as const)('writes %s entries as a single JSON line on console.%s', (level, channel) => {
    const entry = captureLine(channel, () => logger[level]('mensagem'));

    expect(entry).toMatchObject({ level, message: 'mensagem' });
    expect(Date.parse(entry.timestamp)).not.toBeNaN();
  });

  it('omits the meta key entirely when there is no metadata', () => {
    const entry = captureLine('log', () => logger.info('sem meta'));

    expect('meta' in entry).toBe(false);
  });

  it('nests caller metadata under meta', () => {
    const entry = captureLine('log', () => logger.info('com meta', { storyId: 'story-1' }));

    expect(entry.meta).toEqual({ storyId: 'story-1' });
  });

  it('keeps the pg error code, which is how connectivity failures are diagnosed', () => {
    const failure = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });

    const entry = captureLine('error', () => logger.error('db down', failure));

    expect(entry.meta.error).toMatchObject({
      name: 'Error',
      message: 'connect ECONNREFUSED',
      code: 'ECONNREFUSED',
    });
    expect(entry.meta.error.stack).toBeDefined();
  });

  it('serializes a thrown non-Error value instead of losing it', () => {
    const entry = captureLine('error', () => logger.error('estranho', 'just a string'));

    expect(entry.meta.error).toEqual({ message: 'just a string' });
  });

  it('logs an error with metadata but no error object', () => {
    const entry = captureLine('error', () =>
      logger.error('falhou', undefined, { storyId: 'story-1' }),
    );

    expect(entry.meta).toEqual({ storyId: 'story-1' });
  });

  it('produces output that is always parseable, even for messages with quotes and newlines', () => {
    const entry = captureLine('log', () => logger.info('quebra "de" linha\naqui'));

    expect(entry.message).toBe('quebra "de" linha\naqui');
  });
});

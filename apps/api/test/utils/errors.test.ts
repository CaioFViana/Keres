import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/utils/errors';

describe('AppError', () => {
  it('carries the status the route chose alongside a user-facing message', () => {
    const error = new AppError(409, 'Story already exists.');

    expect(error.status).toBe(409);
    expect(error.message).toBe('Story already exists.');
  });

  it('is a real Error, so `instanceof` in onError and stack traces both work', () => {
    const error = new AppError(403, 'Forbidden.');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('AppError');
    expect(error.stack).toBeDefined();
  });

  it('stays distinguishable from a plain Error that happened to reach 500', () => {
    expect(new Error('boom')).not.toBeInstanceOf(AppError);
    expect(new AppError(500, 'Deliberate 500.')).toBeInstanceOf(AppError);
  });
});

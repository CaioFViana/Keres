import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAttemptLimiter } from '../../src/utils/rateLimiter';

describe('createAttemptLimiter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows exactly the configured number of attempts, independently for each key', () => {
    const limiter = createAttemptLimiter({ maxAttempts: 2, windowMs: 60_000 });

    expect(limiter.registerAttempt('ana')).toBe(true);
    expect(limiter.registerAttempt('ana')).toBe(true);
    expect(limiter.registerAttempt('ana')).toBe(false);
    expect(limiter.registerAttempt('bea')).toBe(true);
  });

  it('starts a fresh window only after the complete window elapsed', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const limiter = createAttemptLimiter({ maxAttempts: 1, windowMs: 1_000 });
    expect(limiter.registerAttempt('ana')).toBe(true);
    expect(limiter.registerAttempt('ana')).toBe(false);

    vi.advanceTimersByTime(1_000);
    expect(limiter.registerAttempt('ana')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(limiter.registerAttempt('ana')).toBe(true);
  });

  it('forgets a successful principal so an old failure cannot lock out a valid login', () => {
    const limiter = createAttemptLimiter({ maxAttempts: 1, windowMs: 60_000 });
    limiter.registerAttempt('ana');
    limiter.clearAttempts('ana');

    expect(limiter.registerAttempt('ana')).toBe(true);
  });
});

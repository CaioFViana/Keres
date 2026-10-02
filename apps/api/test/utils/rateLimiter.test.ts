import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAttemptLimiter, MAX_TRACKED_KEYS } from '../../src/utils/rateLimiter';

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

  it('does not keep every key it ever saw: expired ones go first, then the oldest, past the cap', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const limiter = createAttemptLimiter({ maxAttempts: 1, windowMs: 1_000 });
    for (let i = 0; i < MAX_TRACKED_KEYS + 5; i += 1) limiter.registerAttempt(`scan-${i}`);

    // Every window is still live, so the cap alone dropped the oldest ones: a retry of the first
    // key starts a fresh count instead of being locked out by an entry that should be gone.
    expect(limiter.registerAttempt('scan-0')).toBe(true);
    // A recent key is still counted.
    expect(limiter.registerAttempt(`scan-${MAX_TRACKED_KEYS + 4}`)).toBe(false);

    vi.advanceTimersByTime(2_000);
    limiter.registerAttempt('late');
    expect(limiter.registerAttempt(`scan-${MAX_TRACKED_KEYS + 4}`)).toBe(true);
  });

  it('says how long a locked-out key still has to wait, and nothing when it is not locked', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const limiter = createAttemptLimiter({ maxAttempts: 2, windowMs: 60_000 });
    expect(limiter.retryAfterMs('ana')).toBe(0);

    limiter.registerAttempt('ana');
    limiter.registerAttempt('ana');
    expect(limiter.retryAfterMs('ana')).toBe(0);

    limiter.registerAttempt('ana');
    vi.advanceTimersByTime(20_000);
    expect(limiter.retryAfterMs('ana')).toBe(40_000);

    vi.advanceTimersByTime(40_000);
    expect(limiter.retryAfterMs('ana')).toBe(0);
  });
});

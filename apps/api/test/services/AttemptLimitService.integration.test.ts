import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { attemptLimits } from '../../src/db/schema';
import {
  createPersistentAttemptLimiter,
  pruneAttemptLimits,
} from '../../src/services/AttemptLimitService';
import { truncateAll } from '../helpers/database';

beforeEach(truncateAll);

const T0 = Date.parse('2026-01-01T00:00:00.000Z');

describe('createPersistentAttemptLimiter', () => {
  it('allows exactly the configured attempts per key, independently, and starts a fresh window after it', async () => {
    const limiter = createPersistentAttemptLimiter('login', { maxAttempts: 2, windowMs: 1_000 });

    expect(await limiter.registerAttempt('ana', T0)).toBe(true);
    expect(await limiter.registerAttempt('ana', T0 + 10)).toBe(true);
    expect(await limiter.registerAttempt('ana', T0 + 20)).toBe(false);
    expect(await limiter.registerAttempt('bea', T0 + 20)).toBe(true);

    // The window is over only after the whole of it: at its edge the key is still locked.
    expect(await limiter.registerAttempt('ana', T0 + 1_000)).toBe(false);
    expect(await limiter.registerAttempt('ana', T0 + 1_001)).toBe(true);
  });

  it('keeps the lockout across a "restart": a second limiter over the same database sees it', async () => {
    const before = createPersistentAttemptLimiter('login', { maxAttempts: 1, windowMs: 60_000 });
    await before.registerAttempt('ana', T0);
    await before.registerAttempt('ana', T0);

    const afterRestart = createPersistentAttemptLimiter('login', {
      maxAttempts: 1,
      windowMs: 60_000,
    });
    expect(await afterRestart.registerAttempt('ana', T0 + 1)).toBe(false);
  });

  it('keeps scopes apart', async () => {
    const login = createPersistentAttemptLimiter('login', { maxAttempts: 1, windowMs: 60_000 });
    const recovery = createPersistentAttemptLimiter('recovery', {
      maxAttempts: 1,
      windowMs: 60_000,
    });
    await login.registerAttempt('ana', T0);
    await login.registerAttempt('ana', T0);

    expect(await recovery.registerAttempt('ana', T0)).toBe(true);
  });

  it('counts simultaneous attempts instead of losing some of them', async () => {
    const limiter = createPersistentAttemptLimiter('login', { maxAttempts: 3, windowMs: 60_000 });

    const results = await Promise.all(
      Array.from({ length: 8 }, () => limiter.registerAttempt('ana', T0)),
    );

    expect(results.filter(Boolean)).toHaveLength(3);
  });

  it('forgets a key on success, and says how long a locked key still has to wait', async () => {
    const limiter = createPersistentAttemptLimiter('login', { maxAttempts: 1, windowMs: 60_000 });
    expect(await limiter.retryAfterMs('ana', T0)).toBe(0);

    await limiter.registerAttempt('ana', T0);
    expect(await limiter.retryAfterMs('ana', T0)).toBe(0);
    await limiter.registerAttempt('ana', T0);
    expect(await limiter.retryAfterMs('ana', T0 + 20_000)).toBe(40_000);
    expect(await limiter.retryAfterMs('ana', T0 + 60_000)).toBe(0);

    await limiter.clearAttempts('ana');
    expect(await limiter.registerAttempt('ana', T0 + 1)).toBe(true);
  });

  it('treats a very long name as what it is, one key, instead of storing it whole', async () => {
    const limiter = createPersistentAttemptLimiter('login', { maxAttempts: 1, windowMs: 60_000 });
    const long = 'x'.repeat(5_000);

    await limiter.registerAttempt(long, T0);
    expect(await limiter.registerAttempt(long, T0)).toBe(false);
    const [row] = await db.select().from(attemptLimits);
    expect(row.key.length).toBeLessThanOrEqual('login:'.length + 200);
  });
});

describe('pruneAttemptLimits', () => {
  it('drops the counters whose window is long over, and only those', async () => {
    const limiter = createPersistentAttemptLimiter('login', { maxAttempts: 5, windowMs: 60_000 });
    const DAY = 24 * 60 * 60 * 1000;
    await limiter.registerAttempt('old', T0);
    await limiter.registerAttempt('recent', T0 + DAY);

    expect(await pruneAttemptLimits(T0 + DAY + 1)).toBe(1);
    const rows = await db.select().from(attemptLimits);
    expect(rows.map((row) => row.key)).toEqual(['login:recent']);
  });
});

import { eq, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { attemptLimits } from '../db/schema';

/** The longest window any limiter uses is a quarter of an hour; a row this old is dead whatever its scope. */
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_KEY_LENGTH = 200;

const storedKey = (scope: string, name: string) => `${scope}:${name.slice(0, MAX_KEY_LENGTH)}`;

/**
 * Same contract as `createAttemptLimiter` (a sliding window per key, cleared on success), but the counters
 * live in the database: a lockout that a restart wipes is no lockout for whoever can cause the restart.
 * For the credentials that can be guessed (a password, a recovery code); the counters that only shape
 * traffic stay in memory.
 *
 * The counter moves in one statement - insert, or add one / start a new window - so two simultaneous
 * attempts are both counted, which a read-then-write could not promise.
 */
export function createPersistentAttemptLimiter(
  scope: string,
  options: { maxAttempts: number; windowMs: number },
) {
  return {
    /** Returns false once `maxAttempts` have been registered within the current window. */
    async registerAttempt(name: string, now = Date.now()): Promise<boolean> {
      const key = storedKey(scope, name);
      const cutoff = now - options.windowMs;
      const [row] = await db
        .insert(attemptLimits)
        .values({ key, count: 1, windowStart: now })
        .onConflictDoUpdate({
          target: attemptLimits.key,
          set: {
            count: sql`CASE WHEN ${attemptLimits.windowStart} < ${cutoff} THEN 1 ELSE ${attemptLimits.count} + 1 END`,
            windowStart: sql`CASE WHEN ${attemptLimits.windowStart} < ${cutoff} THEN ${now} ELSE ${attemptLimits.windowStart} END`,
          },
        })
        .returning({ count: attemptLimits.count });
      return row.count <= options.maxAttempts;
    },
    /** Milliseconds until `name` may try again, or 0 when it is not locked out. */
    async retryAfterMs(name: string, now = Date.now()): Promise<number> {
      const row = await db.query.attemptLimits.findFirst({
        where: eq(attemptLimits.key, storedKey(scope, name)),
      });
      if (!row || row.count <= options.maxAttempts) return 0;
      return Math.max(0, Number(row.windowStart) + options.windowMs - now);
    },
    async clearAttempts(name: string): Promise<void> {
      await db.delete(attemptLimits).where(eq(attemptLimits.key, storedKey(scope, name)));
    },
  };
}

/** Drops the counters whose window is long over; returns how many. Called daily from the boot. */
export async function pruneAttemptLimits(now = Date.now()): Promise<number> {
  const removed = await db
    .delete(attemptLimits)
    .where(lt(attemptLimits.windowStart, now - PRUNE_AFTER_MS))
    .returning({ key: attemptLimits.key });
  return removed.length;
}

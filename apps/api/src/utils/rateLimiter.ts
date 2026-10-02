/** Keys a limiter holds before it starts forgetting: generous for real use, a ceiling against a flood of new ones. */
export const MAX_TRACKED_KEYS = 10_000;

/**
 * In-memory sliding-window attempt limiter, keyed by an arbitrary string (e.g. a username).
 *
 * Sufficient for a single-instance self-hosted API - doesn't survive a process restart nor
 * scale to multiple replicas. Used where a restart only costs a fresh window (contact form, showcase
 * unlock, sync rate); the guessable credentials (login, recovery code) use `AttemptLimitService`, which
 * keeps its counters in the database.
 */
export function createAttemptLimiter(options: { maxAttempts: number; windowMs: number }) {
  const attemptsByKey = new Map<string, { count: number; windowStart: number }>();

  /**
   * A key is only replaced when the same one comes back, so keys nobody tries again (a scanner walking
   * through usernames or addresses) would pile up for the life of the process. Past the cap, what
   * expired goes; and if everything is still live, the oldest entries - the cap is a bound, not a policy.
   */
  const sweep = (now: number) => {
    if (attemptsByKey.size <= MAX_TRACKED_KEYS) return;
    for (const [key, entry] of attemptsByKey) {
      if (now - entry.windowStart > options.windowMs) attemptsByKey.delete(key);
    }
    for (const key of attemptsByKey.keys()) {
      if (attemptsByKey.size <= MAX_TRACKED_KEYS) break;
      attemptsByKey.delete(key);
    }
  };

  return {
    /** Returns false once `maxAttempts` have been registered within the current window. */
    registerAttempt(key: string): boolean {
      const now = Date.now();
      sweep(now);
      const entry = attemptsByKey.get(key);
      if (!entry || now - entry.windowStart > options.windowMs) {
        attemptsByKey.set(key, { count: 1, windowStart: now });
        return true;
      }
      entry.count += 1;
      return entry.count <= options.maxAttempts;
    },
    /** Milliseconds until `key` may try again, or 0 when it is not locked out. */
    retryAfterMs(key: string): number {
      const entry = attemptsByKey.get(key);
      if (!entry || entry.count <= options.maxAttempts) return 0;
      return Math.max(0, entry.windowStart + options.windowMs - Date.now());
    },
    clearAttempts(key: string): void {
      attemptsByKey.delete(key);
    },
  };
}

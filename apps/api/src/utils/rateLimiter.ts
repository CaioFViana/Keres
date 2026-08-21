/**
 * In-memory sliding-window attempt limiter, keyed by an arbitrary string (e.g. a username).
 *
 * Sufficient for a single-instance self-hosted API - doesn't survive a process restart nor
 * scale to multiple replicas, but no other rate-limiting exists in the project today.
 * Originally written inline in `RecoveryCodeService` for `/auth/forgot-password`; extracted
 * here so `/auth/login` (which had no attempt limiting at all) can reuse the exact same
 * behavior instead of drifting from it.
 */
export function createAttemptLimiter(options: { maxAttempts: number; windowMs: number }) {
  const attemptsByKey = new Map<string, { count: number; windowStart: number }>();

  return {
    /** Returns false once `maxAttempts` have been registered within the current window. */
    registerAttempt(key: string): boolean {
      const now = Date.now();
      const entry = attemptsByKey.get(key);
      if (!entry || now - entry.windowStart > options.windowMs) {
        attemptsByKey.set(key, { count: 1, windowStart: now });
        return true;
      }
      entry.count += 1;
      return entry.count <= options.maxAttempts;
    },
    clearAttempts(key: string): void {
      attemptsByKey.delete(key);
    },
  };
}

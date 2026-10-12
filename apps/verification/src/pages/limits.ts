import type { ServiceState } from '../routes';

/**
 * In-memory limits of the pages, per service instance. They do not survive a restart and do not span several
 * processes: they stop a single address from walking the upload tokens or flooding the upload route, which is the
 * threat here, not a determined crowd. The counters are bounded in size, so an attacker cannot grow them without end.
 */

const MINUTE_MS = 60 * 1000;
export const UPLOAD_PAGE_LIMIT = { max: 60, windowMs: 10 * MINUTE_MS } as const;
export const UPLOAD_POST_LIMIT = { max: 20, windowMs: 10 * MINUTE_MS } as const;
const MAX_KEYS = 10_000;

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Counts one request by `key`. False when the key already used up its requests in the window. */
  allow(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    if (!this.hits.has(key) && this.hits.size >= MAX_KEYS) this.forget(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Drops the keys with no request left in the window; if none, the oldest key. */
  private forget(now: number): void {
    for (const [key, times] of this.hits) {
      if (times.every((at) => now - at >= this.windowMs)) this.hits.delete(key);
    }
    if (this.hits.size >= MAX_KEYS) {
      const oldest = this.hits.keys().next().value;
      if (oldest !== undefined) this.hits.delete(oldest);
    }
  }
}

export interface PageLimits {
  uploadView: RateLimiter;
  uploadPost: RateLimiter;
}

const limitsByState = new WeakMap<ServiceState, PageLimits>();

/** The limits of one service instance, created on first use. */
export function limitsOf(state: ServiceState): PageLimits {
  let limits = limitsByState.get(state);
  if (!limits) {
    limits = {
      uploadView: new RateLimiter(UPLOAD_PAGE_LIMIT.max, UPLOAD_PAGE_LIMIT.windowMs),
      uploadPost: new RateLimiter(UPLOAD_POST_LIMIT.max, UPLOAD_POST_LIMIT.windowMs),
    };
    limitsByState.set(state, limits);
  }
  return limits;
}

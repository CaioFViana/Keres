import { bigintNumber, index, integer, table, text } from '../columns';

/**
 * Failed attempts at something guessable (a password, a recovery code), per key, within a window - so a
 * lockout survives the server restarting. An in-memory counter would be reset by whoever can make the
 * process restart, and that is exactly the person the lockout is for.
 *
 * `key` is `scope:name` (`login:ana`). No foreign keys: the name is whatever was typed, which is often not
 * an account at all. Rows whose window has passed are dropped daily (see `AttemptLimitService.prune`).
 */
export const attemptLimits = table(
  'attempt_limits',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull(),
    /** Epoch milliseconds, not a timestamp: the window is compared in SQL, in both dialects. */
    windowStart: bigintNumber('window_start').notNull(),
  },
  (table) => [index('attempt_limits_window_idx').on(table.windowStart)],
);

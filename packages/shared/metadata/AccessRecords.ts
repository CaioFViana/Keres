/**
 * The access records: when an account was signed in, signed up, recovered or renewed its session, and from which
 * address. Plain constants, no zod, so the admin panel can import them by subpath (see `AuditEvents.ts`).
 *
 * Kept on purpose, and only this much: Marco Civil da Internet (art. 15) makes an application provider organised
 * as a company keep the date, the time and the address of each use of the application for six months, under
 * secrecy. Nothing else about the request is kept - no user agent, no path, no body.
 */

/**
 * What a record stands for. Only the moments that establish a session (or try to): ordinary calls are never
 * recorded here. A refused registration is not listed - it did not establish anything.
 */
export const ACCESS_RECORD_EVENTS = [
  'login',
  'login_failed',
  'register',
  'password_recovery',
  'password_recovery_failed',
  'token_refresh',
] as const;
export type AccessRecordEvent = (typeof ACCESS_RECORD_EVENTS)[number];

/** Longest name of an account that matched no one, kept as it was typed. */
export const ACCESS_RECORD_MAX_USERNAME = 64;

/** Largest export of the access records in one request. */
export const ACCESS_RECORD_EXPORT_MAX_ROWS = 50_000;

/** How many days the access records are kept unless the server is told otherwise (six months). */
export const ACCESS_RECORD_DEFAULT_RETENTION_DAYS = 183;

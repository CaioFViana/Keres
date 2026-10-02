/**
 * What the activity record (the admin's audit trail) is made of. Plain constants, no zod, so the admin
 * panel can import them by subpath without pulling the validation library into its bundle.
 *
 * The record says WHO did WHAT to WHOM and how it ended - never the content: no passwords, tokens, recovery
 * codes, message text or card data is ever stored in it.
 */

/** The area an event belongs to, for filtering and for the summary. */
export const AUDIT_CATEGORIES = [
  'auth',
  'account',
  'friendship',
  'message',
  'story',
  'publication',
  'admin',
  'security',
  'limits',
  'contact',
  'system',
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

/**
 * How it ended: `success`; `failure` (it was refused for what was asked - wrong password, not found, a
 * conflict, a server error); `denied` (it was refused for who asked or how often - no permission, a
 * limit, rate limiting).
 */
export const AUDIT_OUTCOMES = ['success', 'failure', 'denied'] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

/** Actions the summary and the alerts look at by name. */
export const AUDIT_ACTIONS = {
  login: 'auth.login',
  register: 'auth.register',
  passwordRecovery: 'auth.password_recovery',
  messageSentDirect: 'message.sent_direct',
  messageSentAdmin: 'message.sent_admin',
  adminDenied: 'security.admin_access_denied',
  rateLimited: 'security.rate_limited',
  limitExceeded: 'limits.exceeded',
} as const;

/** Largest export of the record in one request. */
export const AUDIT_EXPORT_MAX_ROWS = 10_000;

/** How many days of the record are kept unless the server is told otherwise. */
export const AUDIT_DEFAULT_RETENTION_DAYS = 365;

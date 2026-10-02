import { AUDIT_CATEGORIES, AUDIT_OUTCOMES } from '@keres/shared/metadata/AuditEvents';
import { desc } from 'drizzle-orm';
import { index, json, table, text, timestampNow } from '../columns';

/**
 * The activity record: who did what to whom, when, from where, and how it ended - for the administrators
 * to monitor the server. It is not `api_logs` (the technical log of handled errors and domain notes of
 * the code); this is the audit trail, with a fixed shape that can be filtered and counted.
 *
 * What it keeps is deliberately little: never a password, token, recovery code, message text or any
 * content of a story; `meta` holds the status of the request, the reason a refusal gave, and the names of
 * what was changed - not the values.
 *
 * No foreign keys, like `api_logs` and `publication_log`: it is an observation that must outlive the
 * users and stories it speaks of (the name of an actor is kept as it was), and recording a refusal must
 * not fail because the row it points at is gone.
 */
export const auditEvents = table(
  'audit_events',
  {
    id: text('id').primaryKey(),
    createdAt: timestampNow('created_at'),
    category: text('category', { enum: AUDIT_CATEGORIES }).notNull(),
    /** `area.what`, like `auth.login`. */
    action: text('action').notNull(),
    outcome: text('outcome', { enum: AUDIT_OUTCOMES }).notNull(),
    actorUserId: text('actor_user_id'),
    /** The actor's name when it happened - or, for a login that failed, the name that was tried. */
    actorUsername: text('actor_username'),
    /** The user an action was done to (the friend asked, the person written to), when there is one. */
    subjectUserId: text('subject_user_id'),
    targetType: text('target_type'),
    targetId: text('target_id'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    meta: json('meta'),
  },
  (table) => [
    index('audit_events_created_idx').on(desc(table.createdAt)),
    index('audit_events_category_idx').on(table.category, desc(table.createdAt)),
    index('audit_events_action_idx').on(table.action, desc(table.createdAt)),
    index('audit_events_actor_idx').on(table.actorUserId, desc(table.createdAt)),
    index('audit_events_subject_idx').on(table.subjectUserId, desc(table.createdAt)),
    index('audit_events_outcome_idx').on(table.outcome, desc(table.createdAt)),
  ],
);

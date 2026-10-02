import { index, table, text, timestampNow } from '../columns';

/**
 * One row per message a user sent, kept only long enough to count "messages per day".
 *
 * Not `messages`: a message goes away when both sides delete it, and a daily ceiling that deleting
 * resets would not limit anything. No foreign keys, so it outlives a user; rows older than two days
 * are dropped as new ones arrive - the same arrangement as `publication_log`.
 */
export const messageLog = table(
  'message_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** `direct` counts against the plan's ceiling, `admin` against the fixed one for administrators. */
    kind: text('kind', { enum: ['direct', 'admin'] }).notNull(),
    createdAt: timestampNow('created_at'),
  },
  (table) => [
    index('message_log_user_idx').on(table.userId, table.kind, table.createdAt),
    index('message_log_created_idx').on(table.createdAt),
  ],
);

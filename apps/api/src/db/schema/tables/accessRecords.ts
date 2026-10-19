import { ACCESS_RECORD_EVENTS } from '@keres/shared/metadata/AccessRecords';
import { index, table, text, timestampNow } from '@/db/schema/columns';

/**
 * The access records: when somebody signed in (or tried to), signed up, recovered an account or renewed a session,
 * and from which address. Kept for the six months Marco Civil da Internet (art. 15) asks of an application provider,
 * under secrecy, and no longer: `AccessRecordService.pruneExpired` drops what is older.
 *
 * Minimal on purpose: no user agent, no path, no request body. `user_id` is empty when no account matched the name
 * tried (a wrong name, a recovery for nobody), and then `username_tried` keeps that name instead.
 *
 * No foreign keys, like `audit_events`: a record must outlive the account it names, and writing it must not fail
 * because that account is gone.
 */
export const accessRecords = table(
  'access_records',
  {
    id: text('id').primaryKey(),
    occurredAt: timestampNow('occurred_at'),
    userId: text('user_id'),
    /** The name typed, only when no account matched it (clipped to 64 characters). */
    usernameTried: text('username_tried'),
    event: text('event', { enum: ACCESS_RECORD_EVENTS }).notNull(),
    /** The address the request came from, behind a reverse proxy the forwarded one (see `clientAddress`). */
    ip: text('ip').notNull(),
  },
  (table) => [
    index('access_records_occurred_idx').on(table.occurredAt),
    index('access_records_user_idx').on(table.userId, table.occurredAt),
    index('access_records_ip_idx').on(table.ip, table.occurredAt),
  ],
);

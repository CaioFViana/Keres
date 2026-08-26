// apps/api/src/db/schema/tables/userRecoveryCodes.ts
import { boolean, table, text, timestamp, timestampNow } from '../columns';
import { ulid } from 'ulid';
import { users } from './users';

/**
 * Backup codes for recovering an account without the current password (see RecoveryCodeService).
 * Each user has a fixed batch, generated at registration and replaceable at any time; a used code is
 * never reused, only marked `isUsed`, to preserve the history of how many remain without having to
 * count deleted rows.
 */
export const userRecoveryCodes = table('user_recovery_codes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => ulid()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  /** bcrypt, never the plain code - see the comparison in RecoveryCodeService.redeemCode. */
  codeHash: text('code_hash').notNull(),
  isUsed: boolean('is_used').notNull().default(false),
  usedAt: timestamp('used_at'),
  createdAt: timestampNow('created_at'),
});

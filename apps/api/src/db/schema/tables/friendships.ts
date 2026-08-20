// apps/api/src/db/schema/tables/friendships.ts
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { sql } from 'drizzle-orm';
import { dbEnum, table, text, timestamp, timestampNow, unique } from '../columns';
import { ulid } from 'ulid';
import { users } from './users';

export const friendStatusEnum = dbEnum('friend_status', [
  FriendStatus.PENDING,
  FriendStatus.FRIEND,
  FriendStatus.BLACKLISTED,
]);

export const friendships = table(
  'friendships',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => ulid()),
    // New explicit sender and receiver IDs
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id),
    receiverId: text('receiver_id')
      .notNull()
      .references(() => users.id),
    status: friendStatusEnum('status').notNull().default(FriendStatus.PENDING),
    /**
     * Who issued the blacklist - null unless `status = BLACKLISTED`. `senderId`/`receiverId`
     * only ever mean "who sent the original friend request", not who later blocked whom, so
     * without this column there is no way to tell the blocker from the blocked - see
     * FriendshipService.unblacklistUser, which uses it to refuse letting a blocked user
     * unblock themselves.
     */
    blockedById: text('blocked_by_id').references(() => users.id),
    createdAt: timestampNow('created_at'),
    updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    // Unique constraint on senderId and receiverId to ensure only one pending request per direction
    unq: unique('sender_receiver_unq').on(table.senderId, table.receiverId),
  }),
);

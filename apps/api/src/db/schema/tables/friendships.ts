// apps/api/src/db/schema/tables/friendships.ts
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { sql } from 'drizzle-orm';
import { pgEnum, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { ulid } from 'ulid';
import { users } from './users';

export const friendStatusEnum = pgEnum('friend_status', [
  FriendStatus.PENDING,
  FriendStatus.FRIEND,
  FriendStatus.BLACKLISTED,
]);

export const friendships = pgTable(
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
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Unique constraint on senderId and receiverId to ensure only one pending request per direction
    unq: unique('sender_receiver_unq').on(table.senderId, table.receiverId),
  })
);

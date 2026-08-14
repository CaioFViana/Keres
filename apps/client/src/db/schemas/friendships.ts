import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { servers } from './servers'; // Import servers table
import { users } from './users';

export const friendships = sqliteTable(
  'friendships',
  {
    id: text('id').primaryKey(), // ULID
    serverId: text('server_id')
      .notNull()
      .references(() => servers.id),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.idUser),
    receiverId: text('receiver_id')
      .notNull()
      .references(() => users.idUser),
    friendUsername: text('friend_username').notNull(),
    status: text('status', {
      enum: [FriendStatus.PENDING, FriendStatus.FRIEND, FriendStatus.BLACKLISTED],
    })
      .notNull()
      .default(FriendStatus.PENDING),
    /** Who issued the blacklist - null unless `status` is BLACKLISTED. Mirrors the server's `blockedById` (see apps/api/src/db/schema/tables/friendships.ts for why this exists). */
    blockedById: text('blocked_by_id').references(() => users.idUser),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique('sender_receiver_unq').on(table.senderId, table.receiverId)],
);

export type FriendshipInsert = InferInsertModel<typeof friendships>;
export type FriendshipSelect = InferSelectModel<typeof friendships>;

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
    user1Id: text('user1_id')
      .notNull()
      .references(() => users.idUser),
    user2Id: text('user2_id')
      .notNull()
      .references(() => users.idUser),
    status: text('status', {
      enum: [FriendStatus.PENDING, FriendStatus.FRIEND, FriendStatus.BLACKLISTED],
    })
      .notNull()
      .default(FriendStatus.PENDING),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    version: integer('version').notNull().default(0),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => [
    unique('user1_user2_unq').on(table.user1Id, table.user2Id),
  ]
);

export type FriendshipInsert = InferInsertModel<typeof friendships>;
export type FriendshipSelect = InferSelectModel<typeof friendships>;

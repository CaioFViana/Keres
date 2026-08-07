import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const users = sqliteTable('users', {
  idUser: text('id_user').primaryKey(),
  idServer: text('id_server').notNull(),
  displayName: text('display_name'),
  /** Denormalized from the server, same reasoning as `displayName` - see FriendshipService.ts. */
  tag: text('tag'),
  avatarColor: text('avatar_color'),
  avatarIcon: text('avatar_icon'),
  bio: text('bio'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type UserInsert = InferInsertModel<typeof users>;
export type UserSelect = InferSelectModel<typeof users>;

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  idUser: text('id_user').notNull(),
  userName: text('user_name').notNull(),
  /** Cached copy of the account's @tag on this server, refreshed on login/registration and edits. */
  tag: text('tag'),
  name: text('name').notNull(),
  url: text('url').notNull(),
  lastSyncDate: integer('last_sync_date', { mode: 'timestamp' }), // Nullable
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(), // Added for consistency
  deletedAt: integer('deleted_at', { mode: 'timestamp' }), // Added for consistency
});
export type ServerInsert = InferInsertModel<typeof servers>;
export type ServerSelect = InferSelectModel<typeof servers>;

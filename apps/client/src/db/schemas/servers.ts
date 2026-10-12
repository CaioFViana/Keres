import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  idUser: text('id_user').notNull(),
  userName: text('user_name').notNull(),
  /** Cached copy of the account's @tag on this server, refreshed on login/registration and edits. */
  tag: text('tag'),
  name: text('name').notNull(),
  url: text('url').notNull(),
  lastSyncDate: integer('last_sync_date', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  /** Local copy of the server's terms as accepted, so they read without asking the server. */
  tosText: text('tos_text'),
  /** Version of the accepted copy (`SERVER_TERMS_VERSION` on the server that served it). */
  tosVersion: text('tos_version'),
  tosAcceptedAt: integer('tos_accepted_at', { mode: 'timestamp' }),
  /** Local copy of the server's privacy policy as accepted, readable offline like the terms. */
  privacyText: text('privacy_text'),
  /** Version of the accepted copy (`PRIVACY_POLICY_VERSION` on the server that served it). */
  privacyVersion: text('privacy_version'),
  privacyAcceptedAt: integer('privacy_accepted_at', { mode: 'timestamp' }),
});
export type ServerInsert = InferInsertModel<typeof servers>;
export type ServerSelect = InferSelectModel<typeof servers>;

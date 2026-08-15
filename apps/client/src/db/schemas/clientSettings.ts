import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const clientSettings = sqliteTable('client_settings', {
  id: text('id').primaryKey(),
  localUsername: text('local_username').notNull(),
  language: text('language').notNull(),
  darkMode: integer('dark_mode', { mode: 'boolean' }).notNull(),
  /** Formato de hora das features de Data. `true` = 24h, `false` = AM/PM. */
  use24HourTime: integer('use_24_hour_time', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type ClientSettingsInsert = InferInsertModel<typeof clientSettings>;
export type ClientSettingsSelect = InferSelectModel<typeof clientSettings>;

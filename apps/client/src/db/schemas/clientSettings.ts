import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const clientSettings = sqliteTable('client_settings', {
  id: text('id').primaryKey(),
  localUsername: text('local_username').notNull(),
  language: text('language').notNull(),
  darkMode: integer('dark_mode', { mode: 'boolean' }).notNull(),
  /** Time format for the Date features. `true` = 24h, `false` = AM/PM. */
  use24HourTime: integer('use_24_hour_time', { mode: 'boolean' }).notNull().default(true),
  /** How Gregorian story dates are displayed on this device. */
  dateDisplayFormat: text('date_display_format', { enum: ['iso', 'dmy', 'mdy'] })
    .notNull()
    .default('iso'),
  /** Controls whether the contextual help shortcut is available in the headers. */
  showContextualHelp: integer('show_contextual_help', { mode: 'boolean' }).notNull().default(true),
  /** Controls whether the literary devices item is present in the side menus. */
  suggestLiteraryDevices: integer('suggest_literary_devices', { mode: 'boolean' })
    .notNull()
    .default(true),
  /** File format for map, graph, board and timeline exports on this device. */
  exportFormat: text('export_format', { enum: ['svg', 'png'] })
    .notNull()
    .default('svg'),
  /** Master switch for the guided first-open tours on this device. */
  showTutorials: integer('show_tutorials', { mode: 'boolean' }).notNull().default(true),
  /** JSON `{version, seen[]}` with the tour ids already completed or skipped (see `tutorialProgress`). */
  seenTutorials: text('seen_tutorials').notNull().default('{"version":1,"seen":[]}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type ClientSettingsInsert = InferInsertModel<typeof clientSettings>;
export type ClientSettingsSelect = InferSelectModel<typeof clientSettings>;

import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const stories = sqliteTable('stories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  type: text('type', { enum: ['linear', 'branching'] }).notNull(),
  description: text('description'),
  genre: text('genre'),
  language: text('language'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  extraNotes: text('extra_notes'),
  theme: text('theme'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  serverId: text('server_id'),
  lastOperationLog: integer('last_operation_log').notNull().default(0),
  lastServerSyncedLog: integer('last_server_synced_log').notNull().default(0),
});

export type StoryInsert = InferInsertModel<typeof stories>;
export type StorySelect = InferSelectModel<typeof stories>;

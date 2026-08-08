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
  author: text('author'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  favoriteBehavior: text('favorite_behavior', { enum: ['global', 'individual', 'individual_public'] }).notNull().default('individual'),
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
  // Cursor independente para permitir que, ao tornar favoritos públicos, o cliente busque
  // o histórico relacional anterior sem retroceder ou reproduzir o restante da história.
  lastPublicFavoriteLog: integer('last_public_favorite_log').notNull().default(0),
  // Caller's effective access level on the server for this story ('owner'/'writer'/'reader'),
  // refreshed on every pull. Null means never synced yet (a purely local story).
  myRole: text('my_role', { enum: ['owner', 'writer', 'reader'] }),
});

export type StoryInsert = InferInsertModel<typeof stories>;
export type StorySelect = InferSelectModel<typeof stories>;

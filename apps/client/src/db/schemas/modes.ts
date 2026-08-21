import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Um estado alternativo de um personagem ao longo da obra. Independente do sistema de status:
 * existe mesmo com `stories.stat_system` desligado.
 */
export const modes = sqliteTable('modes', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  characterId: text('character_id').notNull(),
  name: text('name').notNull(),
  modeChanges: text('mode_changes'),
  order: integer('order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type ModeInsert = InferInsertModel<typeof modes>;
export type ModeSelect = InferSelectModel<typeof modes>;

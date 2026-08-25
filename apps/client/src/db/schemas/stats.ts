import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** A measurable axis of the story. Only the primary ones become a radar axis. */
export const stats = sqliteTable('stats', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  name: text('name').notNull(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(true),
  order: integer('order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

/**
 * A tier of the value ladder; the interval is `[minValue, the next one's minValue[`.
 * A null `statId` is the story's default ladder. Deliberately without a unique on (storyId, statId, minValue) -
 * see the comment on the equivalent table in the API.
 */
export const statStrengths = sqliteTable(
  'stat_strengths',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    statId: text('stat_id'),
    label: text('label').notNull(),
    minValue: real('min_value').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => [index('stat_strength_ladder_idx').on(table.storyId, table.statId)],
);

/** A stat's value for a character. A null `modeId` is the normal mode. */
export const statRelations = sqliteTable(
  'stat_relations',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    characterId: text('character_id').notNull(),
    modeId: text('mode_id'),
    statId: text('stat_id').notNull(),
    value: real('value').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => [index('stat_relation_owner_idx').on(table.storyId, table.characterId, table.modeId)],
);

export type StatInsert = InferInsertModel<typeof stats>;
export type StatSelect = InferSelectModel<typeof stats>;
export type StatStrengthInsert = InferInsertModel<typeof statStrengths>;
export type StatStrengthSelect = InferSelectModel<typeof statStrengths>;
export type StatRelationInsert = InferInsertModel<typeof statRelations>;
export type StatRelationSelect = InferSelectModel<typeof statRelations>;

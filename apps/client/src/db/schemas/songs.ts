import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A song of the story: lyrics written as a lead sheet (ChordPro text), their translation, the notes of
 * the tune and the facts a player needs. Separate columns, so that lyrics and melody edited on two
 * devices do not contest the same field, and so that search can read the text.
 */
export const songs = sqliteTable(
  'songs',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    title: text('title').notNull(),
    notes: text('notes'),
    lyrics: text('lyrics').notNull().default(''),
    lyricsTranslation: text('lyrics_translation'),
    melody: text('melody'),
    key: text('key'),
    tempo: integer('tempo'),
    meter: text('meter'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  // Lookups only, never uniqueness: a synced table takes every row the server holds.
  (table) => [index('song_story_idx').on(table.storyId)],
);

export type SongInsert = InferInsertModel<typeof songs>;
export type SongSelect = InferSelectModel<typeof songs>;

import { relations } from 'drizzle-orm';
import { boolean, index, integer, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';

/**
 * A song of the story: lyrics written as a lead sheet (ChordPro text), their translation, the notes
 * of the tune and the facts a player needs. Separate columns, not one document, so that two devices
 * editing different fields never contest the same one.
 */
export const songs = table(
  'songs',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    title: text('title').notNull(),
    notes: text('notes'),
    lyrics: text('lyrics').notNull().default(''),
    lyricsTranslation: text('lyrics_translation'),
    melody: text('melody'),
    key: text('key'),
    tempo: integer('tempo'),
    meter: text('meter'),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [index('song_story_idx').on(table.storyId)],
);

export const songsRelations = relations(songs, ({ one }) => ({
  story: one(stories, { fields: [songs.storyId], references: [stories.id] }),
}));

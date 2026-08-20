import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';
import { chapters } from './chapters';
import { locations } from './locations';
import { choices } from './choices'; // Will be created later
import { characterScenes } from './characterScenes'; // Will be created later
import { itemJourneys } from './itemJourneys'; // Will be created later

export const scenes = table('scenes', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  chapterId: text('chapter_id')
    .notNull()
    .references(() => chapters.id),
  locationId: text('location_id')
    .notNull()
    .references(() => locations.id),
  name: text('name').notNull(),
  index: integer('index').notNull(),
  summary: text('summary'),
  gap: integer('gap'),
  gapType: text('gap_type'),
  duration: integer('duration'),
  durationType: text('duration_type'),
  isStart: boolean('is_start').notNull().default(false),
  isFinish: boolean('is_finish').notNull().default(false),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const scenesRelations = relations(scenes, ({ one, many }) => ({
  story: one(stories, {
    fields: [scenes.storyId],
    references: [stories.id],
  }),
  chapter: one(chapters, {
    fields: [scenes.chapterId],
    references: [chapters.id],
  }),
  location: one(locations, {
    fields: [scenes.locationId],
    references: [locations.id],
  }),
  choices: many(choices),
  characterScenes: many(characterScenes),
  itemJourneys: many(itemJourneys),
}));

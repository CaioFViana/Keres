import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { stories } from './stories';
import { scenes } from './scenes'; // Will be created later

export const locations = pgTable('locations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  name: text('name').notNull(),
  description: text('description'),
  climate: text('climate'),
  culture: text('culture'),
  politics: text('politics'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const locationsRelations = relations(locations, ({ one, many }) => ({
  story: one(stories, {
    fields: [locations.storyId],
    references: [stories.id],
  }),
  scenes: many(scenes),
}));

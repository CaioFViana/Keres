import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { stories } from './stories';

export const notes = pgTable('notes', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  title: text('title').notNull(),
  body: text('body'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const notesRelations = relations(notes, ({ one }) => ({
  story: one(stories, {
    fields: [notes.storyId],
    references: [stories.id],
  }),
}));

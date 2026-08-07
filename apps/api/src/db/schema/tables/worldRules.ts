import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { stories } from './stories';

export const worldRules = pgTable('world_rules', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  title: text('title').notNull(),
  description: text('description'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const worldRulesRelations = relations(worldRules, ({ one }) => ({
  story: one(stories, {
    fields: [worldRules.storyId],
    references: [stories.id],
  }),
}));

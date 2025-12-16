import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { stories } from './stories';

export const galleries = pgTable('galleries', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  ownerId: text('owner_id').notNull(), // Polymorphic relation, validation in handler
  ownerType: text('owner_type'),
  imagePath: text('image_path').notNull(),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const galleriesRelations = relations(galleries, ({ one }) => ({
  story: one(stories, {
    fields: [galleries.storyId],
    references: [stories.id],
  }),
}));

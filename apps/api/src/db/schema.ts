import { pgTable, text, timestamp, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const storyTypeEnum = pgEnum('story_type', ['linear', 'branching']);

// Tables
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const stories = pgTable('stories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  type: storyTypeEnum('type').notNull(),
  description: text('description'),
  genre: text('genre'),
  language: text('language'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  theme: text('theme'),
  serverId: text('server_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  stories: many(stories),
}));

export const storiesRelations = relations(stories, ({ one }) => ({
  user: one(users, {
    fields: [stories.userId],
    references: [users.id],
  }),
}));

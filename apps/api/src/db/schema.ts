import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Enums
export const storyTypeEnum = pgEnum('story_type', ['linear', 'branching']);
export const operationTypeEnum = pgEnum('operation_type', ['create', 'update', 'delete']);
export const storyPermissionTypeEnum = pgEnum('story_permission_type', ['reader', 'writer']);

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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const characters = pgTable('characters', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  name: text('name').notNull(),
  gender: text('gender'),
  race: text('race'),
  subrace: text('subrace'),
  description: text('description'),
  personality: text('personality'),
  motivation: text('motivation'),
  qualities: text('qualities'),
  weaknesses: text('weaknesses'),
  biography: text('biography'),
  plannedTimeline: text('planned_timeline'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const storyPermissions = pgTable('story_permissions', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  userId: text('user_id').notNull().references(() => users.id),
  permissionType: storyPermissionTypeEnum('permission_type').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const operationLog = pgTable('operation_log', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  userId: text('user_id').notNull().references(() => users.id),
  operationVersion: integer('operation_version').notNull(), // Unique per storyId
  operationType: operationTypeEnum('operation_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  payload: jsonb('payload').notNull(), // Store the data/changes as JSONB
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const chapters = pgTable('chapters', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  name: text('name').notNull(),
  index: integer('index').notNull(),
  summary: text('summary'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

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

export const scenes = pgTable('scenes', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  chapterId: text('chapter_id').notNull().references(() => chapters.id),
  locationId: text('location_id').notNull().references(() => locations.id),
  name: text('name').notNull(),
  index: integer('index').notNull(),
  summary: text('summary'),
  gap: integer('gap'),
  gapType: text('gap_type'),
  duration: integer('duration'),
  durationType: text('duration_type'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  stories: many(stories),
  storyPermissions: many(storyPermissions),
  operationLogs: many(operationLog),
}));

export const storiesRelations = relations(stories, ({ one, many }) => ({
  user: one(users, {
    fields: [stories.userId],
    references: [users.id],
  }),
  characters: many(characters), // Add relation to characters
  storyPermissions: many(storyPermissions),
  operationLog: many(operationLog), // Add relation to operationLog
  chapters: many(chapters),
  locations: many(locations),
  scenes: many(scenes),
  notes: many(notes),
  galleries: many(galleries)
}));

export const charactersRelations = relations(characters, ({ one }) => ({
  story: one(stories, {
    fields: [characters.storyId],
    references: [stories.id],
  }),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  story: one(stories, {
    fields: [chapters.storyId],
    references: [stories.id],
  }),
  scenes: many(scenes),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  story: one(stories, {
    fields: [locations.storyId],
    references: [stories.id],
  }),
  scenes: many(scenes),
}));

export const scenesRelations = relations(scenes, ({ one }) => ({
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
}));

export const galleriesRelations = relations(galleries, ({ one }) => ({
  story: one(stories, {
    fields: [galleries.storyId],
    references: [stories.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  story: one(stories, {
    fields: [notes.storyId],
    references: [stories.id],
  }),
}));

export const storyPermissionsRelations = relations(storyPermissions, ({ one }) => ({
  story: one(stories, {
    fields: [storyPermissions.storyId],
    references: [stories.id],
  }),
  user: one(users, {
    fields: [storyPermissions.userId],
    references: [users.id],
  }),
}));

export const operationLogRelations = relations(operationLog, ({ one }) => ({
  story: one(stories, {
    fields: [operationLog.storyId],
    references: [stories.id],
  }),
  user: one(users, {
    fields: [operationLog.userId],
    references: [users.id],
  }),
}));
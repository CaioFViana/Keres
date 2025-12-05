import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, unique } from 'drizzle-orm/pg-core';

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
  title: text('title'),
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

export const choices = pgTable('choices', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  sceneId: text('scene_id').notNull().references(() => scenes.id),
  nextSceneId: text('next_scene_id').notNull().references(() => scenes.id),
  text: text('text').notNull(),
  isImplicit: boolean('is_implicit').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const suggestions = pgTable('suggestions', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  type: text('type').notNull(),
  value: text('value').notNull(),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    unq: unique('story_suggestion_type_value_unq').on(table.storyId, table.type, table.value),
  };
});

export const characterScenes = pgTable('character_scenes', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull().references(() => characters.id),
  storyId: text('story_id').notNull().references(() => stories.id),
  sceneId: text('scene_id').notNull().references(() => scenes.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const characterRelations = pgTable('character_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  character1Id: text('character1_id').notNull().references(() => characters.id),
  character2Id: text('character2_id').notNull().references(() => characters.id),
  relationType: text('relation_type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    unq: unique('story_char1_char2_unq').on(table.storyId, table.character1Id, table.character2Id),
  };
});

export const items = pgTable('items', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  characterOwnerId: text('character_owner_id').references(() => characters.id),
  name: text('name').notNull(),
  category: text('category'),
  description: text('description'),
  initialState: text('initial_state'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const itemJourneys = pgTable('item_journeys', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  itemId: text('item_id').notNull().references(() => items.id),
  sceneId: text('scene_id').notNull().references(() => scenes.id),
  newCharacterOwnerId: text('new_character_owner_id').references(() => characters.id),
  newState: text('new_state').notNull(),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    unq: unique('story_item_scene_unq').on(table.storyId, table.itemId, table.sceneId),
  };
});

export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  name: text('name').notNull(),
  color: text('color'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    unq: unique('story_name_unq').on(table.storyId, table.name),
  };
});

export const tagRelations = pgTable('tag_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  tagId: text('tag_id').notNull().references(() => tags.id),
  relationId: text('relation_id').notNull(),
  relationType: text('relation_type').notNull(), // e.g., 'Character', 'Location', 'Scene'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    unq: unique('story_tag_relation_unq').on(table.storyId, table.tagId, table.relationId, table.relationType),
  };
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
  galleries: many(galleries),
  worldRules: many(worldRules),
  choices: many(choices),
  characterRelations: many(characterRelations),
  items: many(items),
  itemJourneys: many(itemJourneys), // Add itemJourneys
  tagRelations: many(tagRelations), // Add tagRelations
  suggestions: many(suggestions), // Add suggestions
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
  story: one(stories, {
    fields: [characters.storyId],
    references: [stories.id],
  }),
  characterScenes: many(characterScenes),
  characterRelations1: many(characterRelations, { relationName: 'character1' }),
  characterRelations2: many(characterRelations, { relationName: 'character2' }),
  ownedItems: many(items, { relationName: 'ownedItems' }),
  itemJourneys: many(itemJourneys, { relationName: 'changedItemJourneys' }), // Add itemJourneys relation for newCharacterOwnerId
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  story: one(stories, {
    fields: [items.storyId],
    references: [stories.id],
  }),
  characterOwner: one(characters, {
    fields: [items.characterOwnerId],
    references: [characters.id],
    relationName: 'currentOwner',
  }),
  itemJourneys: many(itemJourneys), // Add itemJourneys to items
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  story: one(stories, {
    fields: [chapters.storyId],
    references: [stories.id],
  }),
  scenes: many(scenes),
}));

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
  itemJourneys: many(itemJourneys), // Add itemJourneys to scenes
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

export const worldRulesRelations = relations(worldRules, ({ one }) => ({
  story: one(stories, {
    fields: [worldRules.storyId],
    references: [stories.id],
  }),
}));

export const choicesRelations = relations(choices, ({ one }) => ({
  story: one(stories, {
    fields: [choices.storyId],
    references: [stories.id],
  }),
  scene: one(scenes, {
    fields: [choices.sceneId],
    references: [scenes.id],
    relationName: 'fromScene',
  }),
  nextScene: one(scenes, {
    fields: [choices.nextSceneId],
    references: [scenes.id],
    relationName: 'toScene',
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

export const suggestionsRelations = relations(suggestions, ({ one }) => ({
  story: one(stories, {
    fields: [suggestions.storyId],
    references: [stories.id],
  }),
}));
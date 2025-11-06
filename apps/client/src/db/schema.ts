import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm'; // Import these

export const stories = sqliteTable('stories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  type: text('type', { enum: ['linear', 'branching'] }).notNull(),
  description: text('description'),
  genre: text('genre'),
  language: text('language'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  serverId: text('server_id'),
});

// Export inferred types for stories
export type StoryInsert = InferInsertModel<typeof stories>;
export type StorySelect = InferSelectModel<typeof stories>;

export const clientSettings = sqliteTable('client_settings', {
  id: text('id').primaryKey(),
  localUsername: text('local_username').notNull(),
  language: text('language').notNull(),
  darkMode: integer('dark_mode', { mode: 'boolean' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// Export inferred types for clientSettings
export type ClientSettingsInsert = InferInsertModel<typeof clientSettings>;
export type ClientSettingsSelect = InferSelectModel<typeof clientSettings>;

// New tables below

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  sourceServerId: text('source_server_id'),
});
export type UserInsert = InferInsertModel<typeof users>;
export type UserSelect = InferSelectModel<typeof users>;

export const chapters = sqliteTable('chapters', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  name: text('name').notNull(),
  index: integer('index').notNull(),
  summary: text('summary'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type ChapterInsert = InferInsertModel<typeof chapters>;
export type ChapterSelect = InferSelectModel<typeof chapters>;

export const scenes = sqliteTable('scenes', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  chapterId: text('chapter_id').notNull(),
  locationId: text('location_id').notNull(), // Assuming locationId is always present
  name: text('name').notNull(),
  index: integer('index').notNull(),
  summary: text('summary'),
  gap: integer('gap'),
  gapType: text('gap_type'),
  duration: integer('duration'),
  durationType: text('duration_type'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type SceneInsert = InferInsertModel<typeof scenes>;
export type SceneSelect = InferSelectModel<typeof scenes>;

export const choices = sqliteTable('choices', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  sceneId: text('scene_id').notNull(),
  nextSceneId: text('next_scene_id').notNull(),
  text: text('text').notNull(),
  isImplicit: integer('is_implicit', { mode: 'boolean' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type ChoiceInsert = InferInsertModel<typeof choices>;
export type ChoiceSelect = InferSelectModel<typeof choices>;

export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
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
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type CharacterInsert = InferInsertModel<typeof characters>;
export type CharacterSelect = InferSelectModel<typeof characters>;

export const characterRelations = sqliteTable('character_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  charId1: text('char_id_1').notNull(),
  charId2: text('char_id_2').notNull(),
  relationType: text('relation_type').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type CharacterRelationInsert = InferInsertModel<typeof characterRelations>;
export type CharacterRelationSelect = InferSelectModel<typeof characterRelations>;

export const characterScenes = sqliteTable('character_scenes', {
  characterId: text('character_id').notNull(),
  storyId: text('story_id').notNull(),
  sceneId: text('scene_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type CharacterSceneInsert = InferInsertModel<typeof characterScenes>;
export type CharacterSceneSelect = InferSelectModel<typeof characterScenes>;

export const galleries = sqliteTable('galleries', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  ownerId: text('owner_id').notNull(),
  imagePath: text('image_path').notNull(),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type GalleryInsert = InferInsertModel<typeof galleries>;
export type GallerySelect = InferSelectModel<typeof galleries>;

export const locations = sqliteTable('locations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  climate: text('climate'),
  culture: text('culture'),
  politics: text('politics'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type LocationInsert = InferInsertModel<typeof locations>;
export type LocationSelect = InferSelectModel<typeof locations>;

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  galleryId: text('gallery_id'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type NoteInsert = InferInsertModel<typeof notes>;
export type NoteSelect = InferSelectModel<typeof notes>;

export const suggestions = sqliteTable('suggestions', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  type: text('type').notNull(),
  value: text('value').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type SuggestionInsert = InferInsertModel<typeof suggestions>;
export type SuggestionSelect = InferSelectModel<typeof suggestions>;

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type TagInsert = InferInsertModel<typeof tags>;
export type TagSelect = InferSelectModel<typeof tags>;

export const worldRules = sqliteTable('world_rules', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type WorldRuleInsert = InferInsertModel<typeof worldRules>;
export type WorldRuleSelect = InferSelectModel<typeof worldRules>;
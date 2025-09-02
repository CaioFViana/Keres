import { boolean, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const story = pgTable('story', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  type: text('type').default('linear').notNull(), // 'linear' | 'branching'
  title: text('title').notNull(),
  summary: text('summary'),
  genre: text('genre'),
  language: text('language'),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const characters = pgTable('characters', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => story.id),
  name: text('name').notNull(),
  gender: text('gender'),
  race: text('race'),
  subrace: text('subrace'),
  personality: text('personality'),
  motivation: text('motivation'),
  qualities: text('qualities'),
  weaknesses: text('weaknesses'),
  biography: text('biography'),
  plannedTimeline: text('planned_timeline'),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const chapters = pgTable('chapters', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => story.id),
  name: text('name').notNull(),
  index: integer('index').notNull(),
  summary: text('summary'),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const scenes = pgTable('scenes', {
  id: text('id').primaryKey(),
  chapterId: text('chapter_id')
    .notNull()
    .references(() => chapters.id),
  name: text('name').notNull(),
  index: integer('index').notNull(),
  summary: text('summary'),
  gap: text('gap'), // Storing as text for now, can be parsed as interval/duration later
  duration: text('duration'), // Storing as text for now
  isFavorite: boolean('is_favorite').default(false).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const moments = pgTable('moments', {
  id: text('id').primaryKey(),
  sceneId: text('scene_id')
    .notNull()
    .references(() => scenes.id),
  name: text('name').notNull(),
  location: text('location'),
  index: integer('index').notNull(),
  summary: text('summary'),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const locations = pgTable('locations', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => story.id),
  name: text('name').notNull(),
  description: text('description'),
  climate: text('climate'),
  culture: text('culture'),
  politics: text('politics'),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const gallery = pgTable('gallery', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => story.id),
  ownerId: text('owner_id'), // Can refer to character.id, notes.id, or locations.id
  imagePath: text('image_path').notNull(),
  isFile: boolean('is_file').default(false).notNull(),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const characterMoments = pgTable(
  'character_moments',
  {
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id),
    momentId: text('moment_id')
      .notNull()
      .references(() => moments.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      pk: primaryKey(table.characterId, table.momentId),
    }
  },
)

export const characterRelations = pgTable('character_relations', {
  id: text('id').primaryKey(),
  charId1: text('char_id_1')
    .notNull()
    .references(() => characters.id),
  charId2: text('char_id_2')
    .notNull()
    .references(() => characters.id),
  relationType: text('relation_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const choices = pgTable('choices', {
  id: text('id').primaryKey(),
  sceneId: text('scene_id')
    .notNull()
    .references(() => scenes.id),
  nextSceneId: text('next_scene_id')
    .notNull()
    .references(() => scenes.id),
  text: text('text').notNull(),
  isImplicit: boolean('is_implicit').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const worldRules = pgTable('world_rules', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => story.id),
  title: text('title').notNull(),
  description: text('description'),
  // affected_characters (relational table maybe?) - This will be handled separately if needed
  isFavorite: boolean('is_favorite').default(false).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const notes = pgTable('notes', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => story.id),
  title: text('title').notNull(),
  body: text('body'), // Can be a very long text
  galleryId: text('gallery_id').references(() => gallery.id), // FK to gallery.id, nullable
  isFavorite: boolean('is_favorite').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => story.id),
  name: text('name').notNull(),
  color: text('color'),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const suggestions = pgTable('suggestions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  scope: text('scope').notNull(), // "global" | "story" - enforced at application level
  storyId: text('story_id').references(() => story.id), // Nullable if scope is "global"
  type: text('type').notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

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

export const relations = pgTable('relations', {
  id: text('id').primaryKey(),
  charIdSource: text('char_id_source')
    .notNull()
    .references(() => characters.id),
  charIdTarget: text('char_id_target')
    .notNull()
    .references(() => characters.id),
  sceneId: text('scene_id').references(() => scenes.id),
  momentId: text('moment_id').references(() => moments.id),
  summary: text('summary'),
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

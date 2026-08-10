import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { characters } from './characters';
import { storyPermissions } from './storyPermissions';
import { operationLog } from './operationLog';
import { chapters } from './chapters';
import { locations } from './locations';
import { scenes } from './scenes';
import { notes } from './notes';
import { galleries } from './galleries';
import { worldRules } from './worldRules';
import { choices } from './choices';
import { characterRelations } from './characterRelations';
import { items } from './items';
import { itemJourneys } from './itemJourneys';
import { tagRelations } from './tagRelations';
import { suggestions } from './suggestions';
import { storySchemaFields } from './storySchemaFields';
import { attributeValues } from './attributeValues';
import { favorites } from './favorites';
import { seeAlsoRelations } from './seeAlsoRelations';
import { comments } from './comments';
import { storyTypeEnum } from '../enums';


export const stories = pgTable('stories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  type: storyTypeEnum('type').notNull(),
  description: text('description'),
  genre: text('genre'),
  language: text('language'),
  author: text('author'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  favoriteBehavior: text('favorite_behavior', { enum: ['global', 'individual', 'individual_public'] }).notNull().default('individual'),
  extraNotes: text('extra_notes'),
  theme: text('theme'),
  normalizeSceneTiming: boolean('normalize_scene_timing').notNull().default(false),
  allowReaderComments: boolean('allow_reader_comments').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const storiesRelations = relations(stories, ({ one, many }) => ({
  user: one(users, {
    fields: [stories.userId],
    references: [users.id],
  }),
  characters: many(characters),
  storyPermissions: many(storyPermissions),
  operationLog: many(operationLog),
  chapters: many(chapters),
  locations: many(locations),
  scenes: many(scenes),
  notes: many(notes),
  galleries: many(galleries),
  worldRules: many(worldRules),
  choices: many(choices),
  characterRelations: many(characterRelations),
  items: many(items),
  itemJourneys: many(itemJourneys),
  tagRelations: many(tagRelations),
  suggestions: many(suggestions),
  storySchemaFields: many(storySchemaFields),
  attributeValues: many(attributeValues),
  favorites: many(favorites),
  seeAlsoRelations: many(seeAlsoRelations),
  comments: many(comments),
}));

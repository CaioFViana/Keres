import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';
import { characterScenes } from './characterScenes';
import { characterRelations } from './characterRelations';
import { items } from './items';
import { itemJourneys } from './itemJourneys';

export const characters = table('characters', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
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
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const charactersRelations = relations(characters, ({ one, many }) => ({
  story: one(stories, {
    fields: [characters.storyId],
    references: [stories.id],
  }),
  characterScenes: many(characterScenes),
  characterRelations1: many(characterRelations, { relationName: 'character1' }),
  characterRelations2: many(characterRelations, { relationName: 'character2' }),
  ownedItems: many(items, { relationName: 'ownedItems' }),
  itemJourneys: many(itemJourneys, { relationName: 'changedItemJourneys' }),
}));

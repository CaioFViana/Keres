import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';
import type { WorldPieceSection } from '@keres/shared/entities/WorldRule';

export const worldRules = table('world_rules', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  title: text('title').notNull(),
  description: text('description'),
  section: text('section').$type<WorldPieceSection>().notNull().default('rule'),
  type: text('type'),
  category: text('category'),
  behavior: text('behavior'),
  usability: text('usability'),
  danger: text('danger'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
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

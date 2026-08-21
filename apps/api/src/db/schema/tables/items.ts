import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';
import { characters } from './characters';
import { itemJourneys } from './itemJourneys'; // Will be created later

export const items = table('items', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  characterOwnerId: text('character_owner_id').references(() => characters.id),
  name: text('name').notNull(),
  category: text('category'),
  description: text('description'),
  initialState: text('initial_state'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

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
  itemJourneys: many(itemJourneys),
}));

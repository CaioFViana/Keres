import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow, unique } from '../columns';
import { stories } from './stories';
import { users } from './users';

export const favorites = table(
  'favorites',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    entityId: text('entity_id').notNull(),
    entityType: text('entity_type').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    unq: unique('favorite_story_entity_user_unq').on(
      table.storyId,
      table.entityId,
      table.entityType,
      table.userId,
    ),
  }),
);

export const favoritesRelations = relations(favorites, ({ one }) => ({
  story: one(stories, { fields: [favorites.storyId], references: [stories.id] }),
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
}));

import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { characters } from './characters';
import { stories } from './stories';

/**
 * An alternative state of a character over the course of the work. Independent of the stat system:
 * the table exists and syncs even with `stories.stat_system` off.
 */
export const modes = table('modes', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  characterId: text('character_id')
    .notNull()
    .references(() => characters.id),
  name: text('name').notNull(),
  modeChanges: text('mode_changes'),
  order: integer('order').notNull().default(0),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const modesRelations = relations(modes, ({ one }) => ({
  story: one(stories, { fields: [modes.storyId], references: [stories.id] }),
  character: one(characters, { fields: [modes.characterId], references: [characters.id] }),
}));

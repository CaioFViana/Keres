import type { LocationMapContentType } from '@keres/shared';
import { relations } from 'drizzle-orm';
import { boolean, integer, json, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';

/**
 * A named drawing over gallery images, with location points on top. See `LocationMapSchemas.ts`
 * for why the drawing is one JSON document.
 */
export const locationMaps = table('location_maps', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  name: text('name').notNull(),
  description: text('description'),
  content: json('content').$type<LocationMapContentType>().notNull(),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const locationMapsRelations = relations(locationMaps, ({ one }) => ({
  story: one(stories, {
    fields: [locationMaps.storyId],
    references: [stories.id],
  }),
}));

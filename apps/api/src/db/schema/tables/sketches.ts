import type { SketchContentType } from '@keres/shared';
import { relations } from 'drizzle-orm';
import { boolean, integer, json, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';

/**
 * A drawing board page. See `SketchSchemas.ts` for why the drawing is one
 * JSON document. `coverGalleryId` links the gallery snapshot exported from the canvas.
 */
export const sketches = table('sketches', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  name: text('name').notNull(),
  description: text('description'),
  content: json('content').$type<SketchContentType>().notNull(),
  coverGalleryId: text('cover_gallery_id'),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const sketchesRelations = relations(sketches, ({ one }) => ({
  story: one(stories, {
    fields: [sketches.storyId],
    references: [stories.id],
  }),
}));

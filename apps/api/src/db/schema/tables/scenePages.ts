import { relations } from 'drizzle-orm';
import { boolean, index, integer, table, text, timestamp, timestampNow } from '../columns';
import { scenes } from './scenes';
import { stories } from './stories';

/**
 * One page (or frame) of a scene in a comic or storyboard: an image and the text that goes with it.
 * The scene's pages are read by (rank, id); no uniqueness on `rank`, which two devices can hand out
 * alike offline.
 *
 * `sketch_id` and `gallery_id` carry no foreign key on purpose: a page outlives its image. When the
 * Sketch or the Gallery medium is deleted the page keeps its text and shows "media removed" until the
 * writer puts another image in its place.
 */
export const scenePages = table(
  'scene_pages',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id),
    rank: text('rank').notNull(),
    sketchId: text('sketch_id'),
    galleryId: text('gallery_id'),
    /** 'contain' | 'cover' (see `SCENE_PAGE_FITS`). */
    fit: text('fit').notNull().default('contain'),
    text: text('text'),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('scene_page_story_idx').on(table.storyId),
    index('scene_page_scene_idx').on(table.sceneId),
  ],
);

export const scenePagesRelations = relations(scenePages, ({ one }) => ({
  story: one(stories, { fields: [scenePages.storyId], references: [stories.id] }),
  scene: one(scenes, { fields: [scenePages.sceneId], references: [scenes.id] }),
}));

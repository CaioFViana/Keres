import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  table,
  text,
  timestamp,
  timestampNow,
  uniqueIndex,
} from '../columns';
import { plots } from './plots';
import { scenes } from './scenes';
import { stories } from './stories';

export const plotScenes = table(
  'plot_scenes',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    plotId: text('plot_id')
      .notNull()
      .references(() => plots.id),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id),
    note: text('note').notNull(),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('plot_scene_story_idx').on(table.storyId),
    index('plot_scene_plot_idx').on(table.plotId),
    index('plot_scene_scene_idx').on(table.sceneId),
    uniqueIndex('plot_scene_pair_unique')
      .on(table.plotId, table.sceneId)
      .where(sql`${table.isDeleted} = false`),
  ],
);

export const plotScenesRelations = relations(plotScenes, ({ one }) => ({
  story: one(stories, { fields: [plotScenes.storyId], references: [stories.id] }),
  plot: one(plots, { fields: [plotScenes.plotId], references: [plots.id] }),
  scene: one(scenes, { fields: [plotScenes.sceneId], references: [scenes.id] }),
}));

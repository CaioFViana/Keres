import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const plotScenes = sqliteTable(
  'plot_scenes',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    plotId: text('plot_id').notNull(),
    sceneId: text('scene_id').notNull(),
    note: text('note').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  // Lookups only, never uniqueness: a synced table must take every row the server holds. Two
  // devices can write the same thing offline; the push folds the twin (the `duplicate` reason).
  (table) => [
    index('plot_scene_story_idx').on(table.storyId),
    index('plot_scene_plot_idx').on(table.plotId),
    index('plot_scene_scene_idx').on(table.sceneId),
    index('plot_scene_pair_idx')
      .on(table.plotId, table.sceneId)
      .where(sql`${table.isDeleted} = false`),
  ],
);

export type PlotSceneInsert = InferInsertModel<typeof plotScenes>;
export type PlotSceneSelect = InferSelectModel<typeof plotScenes>;

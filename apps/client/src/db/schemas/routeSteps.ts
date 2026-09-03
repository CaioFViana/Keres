import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const routeSteps = sqliteTable(
  'route_steps',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    routeId: text('route_id').notNull(),
    position: integer('position').notNull(),
    sceneId: text('scene_id').notNull(),
    selectedChoiceId: text('selected_choice_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => [
    index('route_step_story_idx').on(table.storyId),
    index('route_step_route_idx').on(table.routeId),
    uniqueIndex('route_step_position_unique')
      .on(table.routeId, table.position)
      .where(sql`${table.isDeleted} = false`),
  ],
);

export type RouteStepInsert = InferInsertModel<typeof routeSteps>;
export type RouteStepSelect = InferSelectModel<typeof routeSteps>;

import { relations } from 'drizzle-orm';
import { boolean, index, integer, table, text, timestamp, timestampNow } from '../columns';
import { choices } from './choices';
import { routes } from './routes';
import { scenes } from './scenes';
import { stories } from './stories';

export const routeSteps = table(
  'route_steps',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    routeId: text('route_id')
      .notNull()
      .references(() => routes.id),
    position: integer('position').notNull(),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id),
    selectedChoiceId: text('selected_choice_id').references(() => choices.id),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('route_step_story_idx').on(table.storyId),
    index('route_step_route_idx').on(table.routeId),
    // No uniqueness on `position`: it is a place, which two devices can hand out alike offline -
    // steps read by (position, id) instead, the same everywhere.
  ],
);

export const routeStepsRelations = relations(routeSteps, ({ one }) => ({
  story: one(stories, { fields: [routeSteps.storyId], references: [stories.id] }),
  route: one(routes, { fields: [routeSteps.routeId], references: [routes.id] }),
  scene: one(scenes, { fields: [routeSteps.sceneId], references: [scenes.id] }),
  selectedChoice: one(choices, { fields: [routeSteps.selectedChoiceId], references: [choices.id] }),
}));

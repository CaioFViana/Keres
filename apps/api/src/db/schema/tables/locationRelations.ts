import { boolean, integer, table, text, timestamp, timestampNow, unique } from '../columns';
import { locations } from './locations';
import { stories } from './stories';
import type { LocationRelationType } from '@keres/shared';

export const locationRelations = table(
  'location_relations',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    locationAId: text('location_a_id')
      .notNull()
      .references(() => locations.id),
    locationBId: text('location_b_id')
      .notNull()
      .references(() => locations.id),
    relationType: text('relation_type').$type<LocationRelationType>().notNull(),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => {
    return {
      unq: unique('story_loca_locb_type_unq').on(
        table.storyId,
        table.locationAId,
        table.locationBId,
        table.relationType,
      ),
    };
  },
);

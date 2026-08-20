import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { characters } from './characters';
import { stories } from './stories';
import { scenes } from './scenes';

export const characterScenes = table('character_scenes', {
  id: text('id').primaryKey(),
  characterId: text('character_id')
    .notNull()
    .references(() => characters.id),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  sceneId: text('scene_id')
    .notNull()
    .references(() => scenes.id),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

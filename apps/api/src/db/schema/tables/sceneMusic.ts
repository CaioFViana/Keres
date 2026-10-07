import { relations } from 'drizzle-orm';
import { boolean, index, integer, json, table, text, timestamp, timestampNow } from '../columns';
import { scenes } from './scenes';
import { stories } from './stories';

/**
 * A piece of music a scene has: a Song of the story or a Gallery medium (a recording, a link), with
 * the role it plays and the note of when it comes in. A scene's music is read by (rank, id); no
 * uniqueness on `rank`, which two devices can hand out alike offline.
 *
 * `song_id` and `gallery_id` carry no foreign key on purpose: a link outlives its target. When the
 * Song or the Gallery medium is deleted the link keeps its note until the writer points it at
 * something else, and Story Analysis reports it.
 */
export const sceneMusic = table(
  'scene_music',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    sceneId: text('scene_id')
      .notNull()
      .references(() => scenes.id),
    rank: text('rank').notNull(),
    songId: text('song_id'),
    galleryId: text('gallery_id'),
    /** 'in-world' | 'score' (see `SCENE_MUSIC_ROLES`). */
    role: text('role').notNull().default('score'),
    cue: text('cue'),
    /** The labels of the song's sections this scene sings; null is the whole song. */
    sections: json('sections').$type<string[] | null>(),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('scene_music_story_idx').on(table.storyId),
    index('scene_music_scene_idx').on(table.sceneId),
  ],
);

export const sceneMusicRelations = relations(sceneMusic, ({ one }) => ({
  story: one(stories, { fields: [sceneMusic.storyId], references: [stories.id] }),
  scene: one(scenes, { fields: [sceneMusic.sceneId], references: [scenes.id] }),
}));

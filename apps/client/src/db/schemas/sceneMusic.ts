import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { SceneMusicRole } from '@keres/shared';

/**
 * A piece of music a scene has: a Song or a Gallery medium, with the role it plays and the note of
 * when it comes in. Ordered by `rank`. Neither target id is a foreign key: a link outlives its target
 * and keeps its note until it is pointed at something else.
 */
export const sceneMusic = sqliteTable(
  'scene_music',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    sceneId: text('scene_id').notNull(),
    rank: text('rank').notNull(),
    songId: text('song_id'),
    galleryId: text('gallery_id'),
    role: text('role').$type<SceneMusicRole>().notNull().default('score'),
    cue: text('cue'),
    /** The labels of the song's sections this scene sings; null is the whole song. */
    sections: text('sections', { mode: 'json' }).$type<string[] | null>(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  // Lookups only, never uniqueness: a synced table takes every row the server holds.
  (table) => [
    index('scene_music_story_idx').on(table.storyId),
    index('scene_music_scene_idx').on(table.sceneId),
  ],
);

export type SceneMusicInsert = InferInsertModel<typeof sceneMusic>;
export type SceneMusicSelect = InferSelectModel<typeof sceneMusic>;

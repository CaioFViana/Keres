import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { StoryVocabulary } from '@keres/shared/entities/Story';

export const stories = sqliteTable('stories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  type: text('type', { enum: ['linear', 'branching'] }).notNull(),
  description: text('description'),
  genre: text('genre'),
  language: text('language'),
  author: text('author'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  favoriteBehavior: text('favorite_behavior', {
    enum: ['global', 'individual', 'individual_public'],
  })
    .notNull()
    .default('individual'),
  extraNotes: text('extra_notes'),
  theme: text('theme'),
  /**
   * The day number the story's first scene falls on, in whatever calendar is primary.
   *
   * Absent means the story states no absolute date, which is the default: without it the timeline
   * shows elapsed time and no dates at all. It lives on the story rather than on a calendar because
   * "the story opens on this day" is a fact about the narrative, and it has to stay the same when
   * the reader switches which calendar they are reading in.
   */
  timelineEpochDay: integer('timeline_epoch_day'),
  // Stored independently so an opening at night stays at night when dates are derived later.
  timelineEpochSeconds: integer('timeline_epoch_seconds'),
  normalizeSceneTiming: integer('normalize_scene_timing', { mode: 'boolean' })
    .notNull()
    .default(false),
  // Only relevant for stories linked to a server - only there does the reader/writer distinction this
  // field governs exist (see CommentSyncHandler/SyncService on the server).
  allowReaderComments: integer('allow_reader_comments', { mode: 'boolean' })
    .notNull()
    .default(false),
  /** Renders entity names found in the story's text as links. See `utils/entityMentions.ts`. */
  autoLinkMentions: integer('auto_link_mentions', { mode: 'boolean' }).notNull().default(false),
  /** Story Analysis also reports elements that are not referenced anywhere. Opinion, so opt-in. */
  completenessChecks: integer('completeness_checks', { mode: 'boolean' }).notNull().default(false),
  /** Turns on this story's stat system (stats, ladders, radar). */
  statSystem: integer('stat_system', { mode: 'boolean' }).notNull().default(false),
  /** 'letter' | 'number' - how stat values are displayed. */
  statNotation: text('stat_notation').notNull().default('letter'),
  /** Per-story presentation terminology. Null means the app's standard translated vocabulary. */
  vocabulary: text('vocabulary', { mode: 'json' }).$type<StoryVocabulary | null>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  serverId: text('server_id'),
  lastOperationLog: integer('last_operation_log').notNull().default(0),
  lastServerSyncedLog: integer('last_server_synced_log').notNull().default(0),
  // An independent cursor, so that when favourites are made public the client can fetch the earlier
  // relational history without rewinding or replaying the rest of the story.
  lastPublicFavoriteLog: integer('last_public_favorite_log').notNull().default(0),
  // Caller's effective access level on the server for this story ('owner'/'writer'/'reader'),
  // refreshed on every pull. Null means never synced yet (a purely local story).
  myRole: text('my_role', { enum: ['owner', 'writer', 'reader'] }),
});

export type StoryInsert = InferInsertModel<typeof stories>;
export type StorySelect = InferSelectModel<typeof stories>;

import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CommentEntityType } from '@keres/shared';

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  entityType: text('entity_type').$type<CommentEntityType>().notNull(),
  entityId: text('entity_id').notNull(),
  // Exactly one of fieldId/fieldKey is filled in - see packages/shared/entities/Comment.ts.
  fieldId: text('field_id'),
  fieldKey: text('field_key'),
  contentSnapshot: text('content_snapshot'),
  excerptText: text('excerpt_text'),
  authorUserId: text('author_user_id').notNull(),
  commentText: text('comment_text').notNull(),
  criticality: integer('criticality').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type CommentInsert = InferInsertModel<typeof comments>;
export type CommentSelect = InferSelectModel<typeof comments>;

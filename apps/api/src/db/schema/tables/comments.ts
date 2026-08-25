import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';
import { storySchemaFields } from './storySchemaFields';
import { users } from './users';
import type { CommentEntityType } from '@keres/shared';

export const comments = table('comments', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  // Polymorphic (Character/Location/Chapter/Scene/Item/ItemJourney/WorldRule/Choice/Note/Tag) - no
  // database FK, the same pattern as AttributeValue.entityId/NoteRelation.relationId.
  entityType: text('entity_type').$type<CommentEntityType>().notNull(),
  entityId: text('entity_id').notNull(),
  // Exactly one of fieldId/fieldKey is filled in - see packages/shared/entities/Comment.ts.
  fieldId: text('field_id').references(() => storySchemaFields.id),
  fieldKey: text('field_key'),
  contentSnapshot: text('content_snapshot'),
  excerptText: text('excerpt_text'),
  authorUserId: text('author_user_id')
    .notNull()
    .references(() => users.id),
  commentText: text('comment_text').notNull(),
  criticality: integer('criticality').notNull(),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const commentsRelations = relations(comments, ({ one }) => ({
  story: one(stories, { fields: [comments.storyId], references: [stories.id] }),
  field: one(storySchemaFields, { fields: [comments.fieldId], references: [storySchemaFields.id] }),
  author: one(users, { fields: [comments.authorUserId], references: [users.id] }),
}));

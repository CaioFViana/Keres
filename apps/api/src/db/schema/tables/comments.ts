import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { stories } from './stories';
import { storySchemaFields } from './storySchemaFields';
import { users } from './users';

export const comments = pgTable('comments', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  // Polimórfico (Character/Location/Chapter/Scene/Item/ItemJourney/WorldRule/Choice/Note/Tag)
  // - sem FK de banco, mesmo padrão de AttributeValue.entityId/NoteRelation.relationId.
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  // Exatamente um de fieldId/fieldKey é preenchido - ver packages/shared/entities/Comment.ts.
  fieldId: text('field_id').references(() => storySchemaFields.id),
  fieldKey: text('field_key'),
  contentSnapshot: text('content_snapshot'),
  excerptText: text('excerpt_text'),
  authorUserId: text('author_user_id').notNull().references(() => users.id),
  commentText: text('comment_text').notNull(),
  criticality: integer('criticality').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const commentsRelations = relations(comments, ({ one }) => ({
  story: one(stories, { fields: [comments.storyId], references: [stories.id] }),
  field: one(storySchemaFields, { fields: [comments.fieldId], references: [storySchemaFields.id] }),
  author: one(users, { fields: [comments.authorUserId], references: [users.id] }),
}));

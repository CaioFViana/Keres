import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { notes } from './notes';
import { stories } from './stories';
// Import other relevant entities (locations, scenes, etc.) if NoteRelation can link to them
// For now, assuming only characters for relationId, but this might need expansion

export const noteRelations = pgTable('note_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  noteId: text('note_id')
    .notNull()
    .references(() => notes.id),
  relationId: text('relation_id').notNull(),
  relationType: text('relation_type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const noteRelationsRelations = relations(noteRelations, ({ one }) => ({
  story: one(stories, {
    fields: [noteRelations.storyId],
    references: [stories.id],
  }),
  note: one(notes, {
    fields: [noteRelations.noteId],
    references: [notes.id],
  }),
}));

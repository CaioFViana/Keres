import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { notes } from './notes';
import { stories } from './stories';
// Import other relevant entities (locations, scenes, etc.) if NoteRelation can link to them
// For now, assuming only characters for relationId, but this might need expansion

export const noteRelations = table('note_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  noteId: text('note_id')
    .notNull()
    .references(() => notes.id),
  relationId: text('relation_id').notNull(),
  relationType: text('relation_type').notNull(),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
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

import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const editorDrafts = sqliteTable(
  'editor_drafts',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    /**
     * Which work-in-progress this row holds for the entity: `content` for board/location-map
     * canvases, `secondary` for unfinished multi-step form queues, `body` for scene prose.
     * One row per owner keeps writes independent - saving a canvas never rewrites a form draft.
     */
    field: text('field').notNull(),
    /** Markdown prose, or a JSON string for structured drafts (canvas content, form queues). */
    content: text('content').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    uniqueIndex('editor_draft_owner_unique').on(
      table.storyId,
      table.entityType,
      table.entityId,
      table.field,
    ),
  ],
);
export type EditorDraftInsert = InferInsertModel<typeof editorDrafts>;
export type EditorDraftSelect = InferSelectModel<typeof editorDrafts>;

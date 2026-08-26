import { relations } from 'drizzle-orm';
import { index, integer, json, table, text, timestampNow, uniqueIndex } from '../columns';
import { stories } from './stories';
import { users } from './users';
import { operationTypeEnum } from '../enums';

export const operationLog = table(
  'operation_log',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    operationVersion: integer('operation_version').notNull(), // Unique per storyId
    operationType: operationTypeEnum('operation_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    payload: json('payload').notNull(), // Store the data/changes as JSONB
    /**
     * The *entity's* version after this operation, distinct from `operationVersion` (which is the
     * operation's position in the story's sequence). Without this column the pull has no way to report the
     * entity's real version and ends up sending `operationVersion` instead - a far larger number, which
     * makes the client's optimistic concurrency check always pass and therefore never detect a conflict.
     *
     * Null on rows written before this column existed.
     */
    entityVersion: integer('entity_version'),
    createdAt: timestampNow('created_at'),
  },
  (table) => [
    /**
     * A safety net for the atomic counter in `stories.lastOperationVersion`: if some path ever inserts
     * without going through `SyncService.appendOperationLog` (or if the counter is computed wrongly), the
     * database refuses the duplicate instead of silently accepting it - which used to make one of the two
     * operations invisible forever in other collaborators' incremental `pull` (the filter uses
     * `operation_version > cursor`).
     */
    uniqueIndex('operation_log_story_id_operation_version_idx').on(
      table.storyId,
      table.operationVersion,
    ),
    // AdminRecoveryService.browseOperationLog filters/sorts by exactly these columns, in any
    // combination - without these, every filter besides storyId (already covered by the
    // unique index above as a prefix) falls back to a full table scan as the log grows.
    index('operation_log_created_at_idx').on(table.createdAt),
    index('operation_log_user_id_idx').on(table.userId),
    index('operation_log_entity_type_idx').on(table.entityType),
    index('operation_log_operation_type_idx').on(table.operationType),
    // `SyncService.getChangedFieldsSinceVersion` filters by exactly these three columns to
    // reconstruct which fields changed since a client's base version on a `version_conflict` -
    // without this it's a full scan of every operation ever logged for the entity's type.
    index('operation_log_entity_type_entity_id_entity_version_idx').on(
      table.entityType,
      table.entityId,
      table.entityVersion,
    ),
  ],
);

export const operationLogRelations = relations(operationLog, ({ one }) => ({
  story: one(stories, {
    fields: [operationLog.storyId],
    references: [stories.id],
  }),
  user: one(users, {
    fields: [operationLog.userId],
    references: [users.id],
  }),
}));

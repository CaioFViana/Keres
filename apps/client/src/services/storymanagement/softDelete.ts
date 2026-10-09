import { eq, sql } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { AppDrizzleClient } from '../../db';
import { recordLocalOperationSync } from '../../utils/syncUtils';

/** A synced table: rows are never removed, only marked deleted, and carry a version. */
export type SoftDeletableTable = SQLiteTable & {
  id: SQLiteColumn;
  storyId: SQLiteColumn;
  isDeleted: SQLiteColumn;
  deletedAt: SQLiteColumn;
  updatedAt: SQLiteColumn;
  version: SQLiteColumn;
};

export interface SoftDeletedRow {
  id: string;
  storyId: string;
  isDeleted: boolean;
  version: number;
}

/**
 * Marks one row deleted and records the `delete` operation other devices apply: its id, the flag and
 * the new version, which is all a peer needs. Runs inside a `runLocalWrite` unit - the caller does the
 * gates (`assertStoryIsWritable`, the user to log) before it and any cascade after it, in the same unit.
 * Throws when the row is not there, which rolls the unit back.
 */
export function softDeleteRowSync(
  db: AppDrizzleClient,
  table: SoftDeletableTable,
  entityType: string,
  entityId: string,
  userIdToLog: string,
): SoftDeletedRow {
  const deleted = db
    .update(table)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
      version: sql`${table.version} + 1`,
    })
    .where(eq(table.id, entityId))
    .returning({
      id: table.id,
      storyId: table.storyId,
      isDeleted: table.isDeleted,
      version: table.version,
    })
    .get() as unknown as SoftDeletedRow | undefined;
  if (!deleted) {
    throw new Error(`Failed to delete ${entityType} ${entityId} or it was not found.`);
  }
  recordLocalOperationSync(db, deleted.storyId, userIdToLog, 'delete', entityType, entityId, {
    id: deleted.id,
    isDeleted: deleted.isDeleted,
    version: deleted.version,
  });
  return deleted;
}

import { and, eq, max } from 'drizzle-orm';
import { db } from '../../db';
import { operationLog } from '../../db/schema';

/**
 * Conflict-response helpers for the API sync protocol. It derives the fields changed since a
 * client's base entity version and serializes database values for the client comparison screen;
 * it performs no authorization or entity mutation.
 */

/** Fields used by sync bookkeeping, rather than editable entity content. */
const bookkeepingFields = new Set([
  'id',
  'storyId',
  'version',
  'createdAt',
  'updatedAt',
  'deletedAt',
]);

/**
 * Returns the content fields that changed after the client's entity version. A legacy row without
 * entityVersion makes the answer unknowable, so callers receive undefined rather than a false merge.
 */
export async function getChangedFieldsSinceVersion(
  storyId: string,
  entityType: string,
  entityId: string,
  sinceVersion: number,
): Promise<string[] | undefined> {
  const rows = await db.query.operationLog.findMany({
    where: and(
      eq(operationLog.storyId, storyId),
      eq(operationLog.entityType, entityType),
      eq(operationLog.entityId, entityId),
    ),
    columns: { payload: true, entityVersion: true },
  });
  if (rows.some((row) => row.entityVersion === null)) return undefined;

  const fields = new Set<string>();
  for (const row of rows) {
    if ((row.entityVersion as number) <= sinceVersion) continue;
    for (const key of Object.keys((row.payload as Record<string, unknown> | null) ?? {})) {
      if (!bookkeepingFields.has(key)) fields.add(key);
    }
  }
  return Array.from(fields);
}

/** The server operation that last wrote the entity (its own log only, not a container's orders). */
export async function getEntityLastOperationVersion(
  storyId: string,
  entityType: string,
  entityId: string,
): Promise<number | undefined> {
  const [row] = await db
    .select({ last: max(operationLog.operationVersion) })
    .from(operationLog)
    .where(
      and(
        eq(operationLog.storyId, storyId),
        eq(operationLog.entityType, entityType),
        eq(operationLog.entityId, entityId),
      ),
    );
  // Postgres answers an aggregate of a bigint column as text.
  const last = row?.last === null || row?.last === undefined ? undefined : Number(row.last);
  return last !== undefined && Number.isFinite(last) ? last : undefined;
}

/** Converts database Date values before they are shown in the client's conflict comparison. */
export function serializeSyncEntity(entity: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(entity).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  );
}

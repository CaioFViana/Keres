import type { SyncConflict as SharedSyncConflict } from '@keres/shared';
import { syncConflictValuesDiffer } from '@keres/shared';
import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '../../db/schema';
import type { OperationLogSelect } from '../../db/schema';
import { recordLocalOperationSync } from '../../utils/syncUtils';
import { getEntityTable, toEntityColumns } from '../entityTableRegistry';
import { mergeLocalOperationPayloads } from '../SyncConflictService';
import type { SyncContext } from './SyncContext';
import { SNAPSHOT_BOOKKEEPING, withoutDerivedPosition } from './syncConflictHelpers';
import { deriveBaseVersion } from './syncPure';

/**
 * Folding a row the server calls a `duplicate` into its twin.
 *
 * Two devices made the same thing offline - a tag of one name, one pair of related characters, one
 * entity's value for a field - and the server keeps whichever arrived first. This device's row is
 * not a second thing but the same one: it goes away, whatever pointed at it points at the twin,
 * and only where the two disagree on content does the user get asked (a conflict on the twin, with
 * this device's values as "mine"). Nothing is dropped silently and nothing waits forever.
 */

/** Rows that point at an entity by a column of their own. */
const DIRECT_REFERENCES: Record<string, { entityType: string; field: string }[]> = {
  Tag: [{ entityType: 'TagRelation', field: 'tagId' }],
  StorySchemaField: [{ entityType: 'AttributeValue', field: 'fieldId' }],
  StoryArc: [{ entityType: 'Chapter', field: 'arcId' }],
};

/** Rows that point at any entity by a (type, id) pair of columns. */
const POLYMORPHIC_REFERENCES: { entityType: string; typeField: string; idField: string }[] = [
  { entityType: 'Favorite', typeField: 'entityType', idField: 'entityId' },
  { entityType: 'Comment', typeField: 'entityType', idField: 'entityId' },
  { entityType: 'AttributeValue', typeField: 'entityType', idField: 'entityId' },
  { entityType: 'TagRelation', typeField: 'relationType', idField: 'relationId' },
  { entityType: 'NoteRelation', typeField: 'relationType', idField: 'relationId' },
  { entityType: 'GalleryRelation', typeField: 'ownerType', idField: 'ownerId' },
  { entityType: 'SeeAlsoRelation', typeField: 'entityAType', idField: 'entityAId' },
  { entityType: 'SeeAlsoRelation', typeField: 'entityBType', idField: 'entityBId' },
];

function parse(payload: string): Record<string, any> | null {
  try {
    const value: unknown = JSON.parse(payload);
    return value && typeof value === 'object' ? (value as Record<string, any>) : null;
  } catch {
    return null;
  }
}

/**
 * Whether a refusal is a `duplicate` this device can fold: the server named the live twin.
 */
export function isFoldableDuplicate(conflict: SharedSyncConflict): boolean {
  return (
    conflict.reason === 'duplicate' &&
    !!conflict.serverEntity &&
    typeof conflict.serverEntity.id === 'string' &&
    conflict.serverEntity.id !== conflict.entityId
  );
}

/**
 * Folds the local row `entityId` into the server's `twin`. `own` is this row as the server holds
 * it, when it does. Runs under the story's op-log lock (the push settles refusals there). Returns
 * the ids of the queued operations whose references it rewrote: a refusal of one of those in the
 * same push judged the old reference, not the new one.
 */
export async function foldIntoTwin(
  context: SyncContext,
  entityType: string,
  entityId: string,
  twin: Record<string, any>,
  relatedOps: OperationLogSelect[],
  own: Record<string, any> | null = null,
): Promise<Set<string>> {
  const db = context.db()!;
  const storyId = context.storyId()!;
  const table = getEntityTable(entityType) as any;
  const rewritten = new Set<string>();
  if (!table) return rewritten;
  const twinId = twin.id as string;
  const userId =
    (
      await db.query.stories.findFirst({
        where: eq(schema.stories.id, storyId),
        columns: { userId: true },
      })
    )?.userId ?? 'local_user';
  const local = (await db.select().from(table).where(eq(table.id, entityId)).get()) as
    | Record<string, any>
    | undefined;
  const existedOnServer = !!own || !relatedOps.some((op) => op.operationType === 'create');
  const localWantsDelete = relatedOps.some((op) => op.operationType === 'delete');
  const localValues = mergeLocalOperationPayloads(relatedOps);

  // The twin, as the server has it, if the pull has not brought it yet.
  const held = await db.select({ id: table.id }).from(table).where(eq(table.id, twinId)).get();
  if (!held) {
    await db
      .insert(table)
      .values({
        ...toEntityColumns(entityType, twin),
        id: twinId,
        storyId,
        createdAt: new Date(twin.createdAt ?? Date.now()),
        updatedAt: new Date(twin.updatedAt ?? Date.now()),
        deletedAt: null,
        isDeleted: false,
      } as never)
      .run();
  }

  // Whatever pointed at this row points at the twin.
  const pointers = [
    ...(DIRECT_REFERENCES[entityType] ?? []).map((reference) => ({
      entityType: reference.entityType,
      fields: { [reference.field]: twinId } as Record<string, string>,
      matches: (row: Record<string, any>) => row[reference.field] === entityId,
    })),
    ...POLYMORPHIC_REFERENCES.map((reference) => ({
      entityType: reference.entityType,
      fields: { [reference.idField]: twinId } as Record<string, string>,
      matches: (row: Record<string, any>) =>
        row[reference.typeField] === entityType && row[reference.idField] === entityId,
    })),
  ];
  for (const pointer of pointers) {
    const pointerTable = getEntityTable(pointer.entityType) as any;
    if (!pointerTable) continue;
    const rows = (
      (await db
        .select()
        .from(pointerTable)
        .where(eq(pointerTable.storyId, storyId))
        .all()) as Record<string, any>[]
    ).filter(
      // A deleted reference is history: it keeps pointing where it did.
      (row) => !row.isDeleted && pointer.matches(row),
    );
    for (const row of rows) {
      const queued = await db.query.operationLogs.findMany({
        where: and(
          eq(schema.operationLogs.storyId, storyId),
          eq(schema.operationLogs.entityType, pointer.entityType),
          eq(schema.operationLogs.entityId, row.id),
          eq(schema.operationLogs.isSynced, false),
        ),
      });
      const created = queued.some((op) => op.operationType === 'create');
      // Every queued operation carrying the old reference carries the twin instead.
      for (const op of queued) {
        const payload = parse(op.payload);
        if (!payload || !Object.keys(pointer.fields).some((field) => field in payload)) continue;
        await db
          .update(schema.operationLogs)
          .set({ payload: JSON.stringify({ ...payload, ...pointer.fields }) })
          .where(eq(schema.operationLogs.id, op.id))
          .run();
        rewritten.add(op.id);
      }
      if (created) {
        await db.update(pointerTable).set(pointer.fields).where(eq(pointerTable.id, row.id)).run();
      } else {
        // The server holds this row pointing at the old one: moving it is an edit of its own.
        const moved = (await db
          .update(pointerTable)
          .set({ ...pointer.fields, version: row.version + 1, updatedAt: new Date() })
          .where(eq(pointerTable.id, row.id))
          .returning({ version: pointerTable.version })
          .get()) as { version: number } | undefined;
        if (moved) {
          recordLocalOperationSync(db, storyId, userId, 'update', pointer.entityType, row.id, {
            ...pointer.fields,
            version: moved.version,
          });
        }
      }
    }
  }

  // This row's own operations are settled: it is the twin from here on.
  if (relatedOps.length > 0) {
    await db
      .update(schema.operationLogs)
      .set({ conflictState: 'abandoned', isSynced: true })
      .where(
        inArray(
          schema.operationLogs.id,
          relatedOps.map((op) => op.id),
        ),
      )
      .run();
  }
  if (own?.isDeleted) {
    // A restore made it a twin: the server keeps it deleted, so this row goes back to being the
    // tombstone the server holds - nothing to send.
    await db
      .update(table)
      .set({
        ...toEntityColumns(entityType, withoutDerivedPosition(entityType, own)),
        isDeleted: true,
        deletedAt: new Date(own.deletedAt ?? Date.now()),
        updatedAt: new Date(own.updatedAt ?? Date.now()),
        version: own.version,
      } as never)
      .where(eq(table.id, entityId))
      .run();
  } else if (existedOnServer && local) {
    // The server holds this row live (an edit of its key made it a twin): it goes away there too -
    // even when it is already deleted here, as the delete queued behind that edit was abandoned
    // with it. Its unsent edits go: it is the server's row that becomes the tombstone.
    const base =
      typeof own?.version === 'number'
        ? own.version
        : relatedOps[0]
          ? deriveBaseVersion(parse(relatedOps[0].payload) ?? {})
          : undefined;
    const version = (base ?? local.version) + 1;
    await db
      .update(table)
      .set({
        ...(own ? toEntityColumns(entityType, withoutDerivedPosition(entityType, own)) : {}),
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
        version,
      } as never)
      .where(eq(table.id, entityId))
      .run();
    recordLocalOperationSync(db, storyId, userId, 'delete', entityType, entityId, {
      id: entityId,
      isDeleted: true,
      version,
    });
  } else if (!existedOnServer) {
    // Never on the server: nothing to tell anyone, only a local row to drop.
    await db.delete(table).where(eq(table.id, entityId)).run();
  }

  // Where the two disagree, the user decides - on the twin, with this device's values as "mine".
  if (!localWantsDelete) {
    const differing = Object.fromEntries(
      Object.entries(withoutDerivedPosition(entityType, localValues)).filter(
        ([field, value]) =>
          !SNAPSHOT_BOOKKEEPING.has(field) &&
          field !== 'rank' &&
          field in twin &&
          syncConflictValuesDiffer(value, twin[field]),
      ),
    );
    if (Object.keys(differing).length > 0) {
      await context.conflictService().recordConflict({
        storyId,
        entityType,
        entityId: twinId,
        reason: 'concurrent_edit',
        localOperationType: 'update',
        localOperationIds: [],
        localValues: differing,
        serverValues: withoutDerivedPosition(entityType, twin),
        clientVersion: null,
        serverVersion: typeof twin.version === 'number' ? twin.version : null,
        message: `Another device made ${entityType} ${twinId} as this device made ${entityId}.`,
      });
    }
  }
  return rewritten;
}

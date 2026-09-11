import { getStoryExportCollections, OperationLogEntityType } from '@keres/shared';
import type { DatabaseStoryPackageImportContext } from './DatabaseStoryPackageImportContext';
import { getApiEntityTable } from '../entity-solvers/ApiEntityTableRegistry';

/**
 * Database adapter for ordinary rows in a portable package. Import phases own conversion, ID
 * remapping, and validation; this file alone resolves entity types to database tables and writes rows.
 */
const portableCollectionEntityTypes = new Set(
  getStoryExportCollections().map(({ entityType }) => entityType),
);

async function insertRows(
  context: DatabaseStoryPackageImportContext,
  entityType: OperationLogEntityType,
  rows: readonly Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const table = getApiEntityTable(entityType);
  if (!table) {
    throw new Error(`No database table configured for story package entity ${entityType}.`);
  }
  await context.tx.insert(table).values(rows);
}

/** Inserts the package root, which is not represented by an export collection. */
export async function insertStoryRoot(
  context: DatabaseStoryPackageImportContext,
  story: Record<string, unknown>,
): Promise<void> {
  await insertRows(context, OperationLogEntityType.Story, [story]);
}

/** Inserts a handler-owned export collection after its import phase has prepared its rows. */
export async function insertPortableCollection(
  context: DatabaseStoryPackageImportContext,
  entityType: OperationLogEntityType,
  rows: readonly Record<string, unknown>[],
): Promise<void> {
  if (!portableCollectionEntityTypes.has(entityType)) {
    throw new Error(`Entity ${entityType} is not a portable story collection.`);
  }
  await insertRows(context, entityType, rows);
}

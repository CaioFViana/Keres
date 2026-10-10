/**
 * @jest-environment node
 */
import * as sharedSchemas from '@keres/shared';
import { getTableColumns, is } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as clientSchema from '../../src/db/schema';

/**
 * An entity is described three times: the client's SQLite table, the shared zod schema the sync wire and the
 * API validate with, and (for the API) its own Postgres/SQLite table. The API side has `migrationParity`; this
 * is the missing client <-> shared half: a column added to one and forgotten in the other would sync as
 * data silently dropped (zod strips unknown keys) or rejected.
 *
 * Tables are matched to schemas by name (`worldRules` -> `WorldRuleSchema`). Tables with no schema of that
 * name are the client's own (settings, drafts, conflicts, the operation log...) and are not compared.
 */

const singular = (word: string): string => {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('sses')) return word.slice(0, -2);
  return word.endsWith('s') ? word.slice(0, -1) : word;
};
const pascal = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

type ZodObjectLike = { shape: Record<string, unknown> };

const isZodObject = (value: unknown): value is ZodObjectLike =>
  typeof value === 'object' && value !== null && 'shape' in value;

/** Same name, different thing: the shared `SyncConflictSchema` is the server's payload, the client table is its own conflict log. */
const NOT_THE_SAME_ENTITY = new Set(['syncConflicts']);

const tables = Object.entries(clientSchema).filter(
  ([exportName, value]) => is(value, SQLiteTable) && !NOT_THE_SAME_ENTITY.has(exportName),
);
const pairs = tables
  .map(([exportName, table]) => {
    const schemaName = `${pascal(singular(exportName))}Schema`;
    const schema = (sharedSchemas as Record<string, unknown>)[schemaName];
    return { exportName, schemaName, table: table as SQLiteTable, schema };
  })
  .filter((pair): pair is typeof pair & { schema: ZodObjectLike } => isZodObject(pair.schema));

/**
 * Columns one side has and the other does not, today. Each entry is a decision someone took on purpose (a
 * client-only cache column, a field the wire carries under another shape); the test fails on any NEW
 * difference and on an entry that stopped being true, so the list can only shrink.
 */
const KNOWN_DIFFERENCES: Record<string, { onlyClient?: string[]; onlyShared?: string[] }> = {
  // The local friendship row carries the server it belongs to and the name shown for the friend.
  FriendshipSchema: { onlyClient: ['friendUsername', 'serverId'] },
  // Media files live on the device: where they are and how far their transfer got.
  GallerySchema: { onlyClient: ['downloadState', 'localPath', 'thumbnailPath', 'uploadState'] },
  // Legacy: created with the first migration, never read, unknown to the API and the wire. Drop it in a migration.
  NoteSchema: { onlyClient: ['galleryId'] },
  // Which story a pack was made from, kept on this device.
  PackSchema: { onlyClient: ['sourceStoryId'] },
  // The sync bookkeeping of a story on this device (log positions, the server it is linked to, the role held).
  StorySchema: {
    onlyClient: [
      'lastOperationLog',
      'lastPublicFavoriteLog',
      'lastServerSyncedLog',
      'myRole',
      'serverId',
    ],
  },
  // The client row is a local cache of what the server publishes; the server-side schema has more (owner, package and media counts).
  StoryPublicationSchema: {
    onlyClient: ['notified', 'serverId'],
    onlyShared: [
      'arcId',
      'formatVersion',
      'mediaIncluded',
      'mediaTotal',
      'ownerUserId',
      'packageIncluded',
    ],
  },
};

describe('client tables and shared schemas describe the same entities', () => {
  it('finds a schema for the synced entities (the matching itself is not silently empty)', () => {
    expect(pairs.length).toBeGreaterThan(25);
  });

  it.each(pairs.map((pair) => [pair.exportName, pair] as const))(
    '%s has the columns of its shared schema',
    (_name, { table, schema, schemaName }) => {
      const clientColumns = Object.keys(getTableColumns(table)).sort();
      const sharedColumns = Object.keys(schema.shape).sort();
      const known = KNOWN_DIFFERENCES[schemaName] ?? {};

      const onlyClient = clientColumns.filter((column) => !sharedColumns.includes(column));
      const onlyShared = sharedColumns.filter((column) => !clientColumns.includes(column));

      expect({ onlyClient, onlyShared }).toEqual({
        onlyClient: known.onlyClient ?? [],
        onlyShared: known.onlyShared ?? [],
      });
    },
  );
});

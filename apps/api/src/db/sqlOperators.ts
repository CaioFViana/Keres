import { ilike, like, sql, type SQL } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';
import { usingSqlite } from './dialect';
import { stories } from './schema';

/**
 * Operators whose SQL changes from one engine to the other.
 *
 * The rest of this API's queries are written by drizzle and come out identical in both dialects; what
 * is left over is this.
 */

/**
 * Substring search, ignoring case.
 *
 * `ILIKE` is Postgres's. On SQLite `LIKE` already ignores case by itself, but only in ASCII - so the
 * comparison is made with both sides lowercased, which gives the same result for the unaccented Latin
 * alphabet.
 *
 * A known and accepted difference: on Postgres "José" matches "josé"; on SQLite it does not, because
 * neither its `LIKE` nor its `lower()` knows about accents. That affects the administrative search by
 * username and story title - it finds less, never wrongly.
 */
export function insensitiveLike(column: AnyColumn, pattern: string): SQL {
  if (usingSqlite) {
    return like(sql`lower(${column})`, pattern.toLowerCase());
  }
  return ilike(column, pattern);
}

/**
 * Serialises concurrent transactions touching the same pair of users.
 *
 * On Postgres it is a per-transaction advisory lock: two friendship requests in opposite directions
 * (A→B and B→A) contend for the same key and never read "does not exist" at the same time - the
 * uniqueness constraint alone only catches the exact duplicate (A→B twice).
 *
 * On SQLite there is no advisory lock, and none is needed: `withWriteTransaction` opens the
 * transaction in `immediate` mode, which takes the whole database's write lock right at the start.
 * It is a coarser serialisation - it applies to every writer, not only to this pair - and for a
 * single-process server that is acceptable.
 */
export async function lockUserPair(
  tx: object,
  firstUserId: string,
  secondUserId: string,
): Promise<void> {
  if (usingSqlite) {
    return;
  }
  const [lockKeyA, lockKeyB] = [firstUserId, secondUserId].sort();
  await executePostgresStatement(
    tx,
    sql`select pg_advisory_xact_lock(hashtext(${lockKeyA}), hashtext(${lockKeyB}))`,
  );
}

/**
 * Locks one story while legacy public-favourite operation history is materialised. SQLite already
 * serialises the surrounding write transaction and therefore needs no statement of its own.
 */
export async function lockStoryForUpdate(tx: object, storyId: string): Promise<void> {
  if (usingSqlite) return;
  await executePostgresStatement(
    tx,
    sql`select ${stories.id} from ${stories} where ${stories.id} = ${storyId} for update`,
  );
}

/** Raw PostgreSQL execution is deliberately confined to this dialect adapter. */
async function executePostgresStatement(tx: object, query: SQL): Promise<void> {
  const executor = tx as { execute(statement: SQL): Promise<unknown> };
  await executor.execute(query);
}

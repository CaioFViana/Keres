import { ilike, like, sql, type SQL } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';
import { usingSqlite } from './dialect';

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
 * On SQLite there is no advisory lock, and none is needed: the transaction is opened in `immediate`
 * mode (see `writeTransactionConfig`), which takes the whole database's write lock right at the start.
 * It is a coarser serialisation - it applies to every writer, not only to this pair - and for a
 * single-process server that is acceptable.
 */
export async function lockUserPair(
  tx: { execute: (query: SQL) => Promise<unknown> },
  firstUserId: string,
  secondUserId: string,
): Promise<void> {
  if (usingSqlite) {
    return;
  }
  const [lockKeyA, lockKeyB] = [firstUserId, secondUserId].sort();
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKeyA}), hashtext(${lockKeyB}))`);
}

/**
 * Configuration for a transaction that is going to write and must not compete with another.
 *
 * Empty on Postgres, where serialisation comes from the advisory lock above. On SQLite it asks for
 * `immediate`, which acquires the write lock on opening rather than at the first `INSERT` - without
 * that, two transactions that read before writing can reach the write together and one of them dies
 * with "database is locked".
 */
export const writeTransactionConfig = (usingSqlite ? { behavior: 'immediate' } : {}) as Record<
  string,
  never
>;

import { and, count, eq, max } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, withWriteTransaction } from '../../db';
import { lockStoryForUpdate } from '../../db/sqlOperators';
import { favorites, operationLog, stories } from '../../db/schema';

/**
 * Checksum of a story's favorites roster: how many rows exist and the highest version
 * among them. Every favorite mutation (create, update, soft-delete) either adds a row or
 * bumps a version, so any change to the roster changes one of the two numbers.
 *
 * It deliberately covers *all* rows for the story, including the requesting user's own:
 * the client computes the same aggregate over its local table without needing to know
 * its own server-side user id. The snapshot itself stays others-only (see the pull
 * service) - the fingerprint only decides whether sending it is necessary.
 */
export interface FavoritesFingerprint {
  count: number;
  maxVersion: number;
}

/** Single-row aggregate; the cheap half of the conditional public-favorites snapshot. */
export async function getFavoritesFingerprint(storyId: string): Promise<FavoritesFingerprint> {
  const [row] = await db
    .select({ count: count(), maxVersion: max(favorites.version) })
    .from(favorites)
    .where(eq(favorites.storyId, storyId));
  return { count: row?.count ?? 0, maxVersion: row?.maxVersion ?? 0 };
}

/**
 * Materialises operation history for snapshot-uploaded favourites that became public later.
 *
 * Imported stories are inserted row by row with no operation logs, so a story whose
 * `favoriteBehavior` is (or becomes) `individual_public` would leave its pre-existing
 * favorites invisible to cursor-based pulls until something wrote their history. This runs
 * at the events that create that gap - story import and the switch to public - plus as a
 * self-healing fallback on pulls whose fingerprint mismatches. It used to run on every
 * pull of every public story, rereading the whole roster each time to (almost always)
 * find nothing to do.
 */
const REPAIR_BUSY_ATTEMPTS = 8;
const REPAIR_BUSY_BASE_DELAY_MS = 25;

const isSqliteBusyError = (error: unknown): boolean =>
  (error as { code?: unknown })?.code === 'SQLITE_BUSY' ||
  /SQLITE_BUSY/i.test(error instanceof Error ? error.message : String(error ?? ''));

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function ensurePublicFavoriteOperationLogs(
  storyId: string,
): Promise<{ count: number; maxOperationVersion: number }> {
  // A write transaction, not a plain one: the version allocation below is read-modify-write,
  // and two repairs racing (two pulls tripping over the same fresh publicity) must serialize
  // instead of colliding on the (storyId, operationVersion) unique index. On SQLite the row
  // lock below is a no-op, so the immediate-mode transaction is the entire serialisation -
  // plus a bounded retry, because SQLITE_BUSY still escapes when two repairs overlap on one
  // file-backed connection. Retrying is safe: every attempt recomputes the missing set, so a
  // loser simply finds nothing left to do.
  let attempt = 0;
  for (;;) {
    try {
      return await withWriteTransaction(async (tx) => {
        await lockStoryForUpdate(tx, storyId);

        // Sequential, never Promise.all: concurrent statements on one transaction connection
        // trip each other (SQLITE_BUSY) exactly when two repairs race, which is the case this
        // function exists to survive.
        const favoriteRows = await tx
          .select()
          .from(favorites)
          .where(and(eq(favorites.storyId, storyId), eq(favorites.isDeleted, false)));
        const loggedFavoriteRows = await tx
          .select({ entityId: operationLog.entityId })
          .from(operationLog)
          .where(
            and(
              eq(operationLog.storyId, storyId),
              eq(operationLog.entityType, 'Favorite'),
              eq(operationLog.operationType, 'create'),
            ),
          );
        const storyRow = await tx
          .select({ lastOperationVersion: stories.lastOperationVersion })
          .from(stories)
          .where(eq(stories.id, storyId));
        const loggedIds = new Set(loggedFavoriteRows.map((row) => row.entityId));
        const missingFavorites = favoriteRows.filter((favorite) => !loggedIds.has(favorite.id));
        let nextOperationVersion = storyRow.at(0)?.lastOperationVersion || 0;

        for (const favorite of missingFavorites) {
          nextOperationVersion += 1;
          await tx.insert(operationLog).values({
            id: ulid(),
            storyId,
            userId: favorite.userId,
            operationVersion: nextOperationVersion,
            operationType: 'create',
            entityType: 'Favorite',
            entityId: favorite.id,
            payload: {
              entityId: favorite.entityId,
              entityType: favorite.entityType,
              userId: favorite.userId,
            },
            entityVersion: favorite.version,
            createdAt: favorite.createdAt,
          });
        }
        if (missingFavorites.length > 0) {
          await tx
            .update(stories)
            .set({ lastOperationVersion: nextOperationVersion })
            .where(eq(stories.id, storyId));
        }
        return { count: missingFavorites.length, maxOperationVersion: nextOperationVersion };
      });
    } catch (error) {
      attempt += 1;
      if (!isSqliteBusyError(error) || attempt >= REPAIR_BUSY_ATTEMPTS) throw error;
      await delay(Math.min(REPAIR_BUSY_BASE_DELAY_MS * 2 ** (attempt - 1), 400));
    }
  }
}

import { count, eq, max } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import { favorites } from '../../db/schema';

/**
 * Local mirror of the server's public-favorites roster checksum (`getFavoritesFingerprint`
 * on the API): row count plus highest version over the story's favorites. Sent on every
 * pull of an `individual_public` story so the server can skip re-sending the full roster
 * when nothing changed. Covers all local rows including the user's own - same predicate
 * as the server, so no server-side user id is needed to compute it. Own unpushed edits
 * merely cause one redundant snapshot until the push lands.
 */
export interface FavoritesFingerprint {
  count: number;
  maxVersion: number;
}

export async function computeLocalFavoritesFingerprint(
  db: AppDrizzleClient,
  storyId: string,
): Promise<FavoritesFingerprint> {
  const [row] = await db
    .select({ count: count(), maxVersion: max(favorites.version) })
    .from(favorites)
    .where(eq(favorites.storyId, storyId))
    .all();
  return { count: row?.count ?? 0, maxVersion: row?.maxVersion ?? 0 };
}

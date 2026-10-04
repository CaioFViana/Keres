import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { playPurchaseClaims } from '../../db/schema';
import { AppError } from '../../utils/errors';

/** sha256 of a store purchase token: claims keep the hash, never the token itself. */
export function hashPurchaseToken(purchaseToken: string): string {
  return createHash('sha256').update(purchaseToken, 'utf8').digest('hex');
}

/**
 * Binds a store purchase token to the first account that relays it. A token alone is enough to
 * relay, so without this someone else's unfinished purchase could be relayed as one's own; any
 * other account relaying the same token is refused. Retrying one's own token always passes. The
 * insert-or-read is one row keyed by the hash, so two accounts racing the same token still end
 * with a single owner - and the event application checks the owner again anyway.
 */
export async function claimPurchaseToken(
  userId: string,
  purchaseToken: string,
  productId: string,
): Promise<void> {
  const purchaseTokenHash = hashPurchaseToken(purchaseToken);
  await db
    .insert(playPurchaseClaims)
    .values({ purchaseTokenHash, userId, productId })
    .onConflictDoNothing();
  const claim = await db.query.playPurchaseClaims.findFirst({
    where: eq(playPurchaseClaims.purchaseTokenHash, purchaseTokenHash),
  });
  if (!claim || claim.userId !== userId) {
    throw new AppError(403, 'This purchase belongs to another account.');
  }
}

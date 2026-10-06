import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { stories } from '../../db/schema';
import { logger } from '../../utils/logger';
import { storyNsfwService } from '../StoryNsfwService';
import { ensurePublicFavoriteOperationLogs } from './publicFavoriteRepair';

/** What a push does once per story edit, after the operations were stored. Both are best-effort. */

/**
 * A Story op may have turned `isNsfw` on, which expels whoever is not age-verified - once per
 * push, not once per operation. Best-effort like the favorite repair above: the method itself
 * is a no-op unless the story is NSFW now, so turning the flag off (or a concurrent toggle)
 * needs no extra handling.
 */
export async function enforceNsfwCollaboratorsAfterStoryChange(storyId: string): Promise<void> {
  try {
    await storyNsfwService.revokeUnverifiedCollaborators(storyId);
  } catch (error) {
    logger.error('SyncService: NSFW collaborator enforcement after story change failed', error);
  }
}

/**
 * A Story op may have flipped `favoriteBehavior` to `individual_public`, exposing imported
 * favorites that have no operation logs. Repairing here - once per story edit, not once per
 * pull per client - covers the switch at its source. Best-effort like compaction: the
 * pull-time fingerprint mismatch re-runs the same repair, so a failure here self-heals.
 */
export async function repairPublicFavoritesAfterStoryChange(storyId: string): Promise<void> {
  try {
    const current = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      columns: { favoriteBehavior: true },
    });
    if (current?.favoriteBehavior === 'individual_public') {
      await ensurePublicFavoriteOperationLogs(storyId);
    }
  } catch (error) {
    logger.error('SyncService: public favorite repair after story change failed', error);
  }
}

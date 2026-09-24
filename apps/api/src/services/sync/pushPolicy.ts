import type { StoryUpdate, UpdateStoryUpdate } from '@keres/shared';

const COMPACTION_MIN_INTERVAL_MS = 60 * 60 * 1000;
const COMPACTION_THROTTLE_MAX_STORIES = 1000;
const lastCompactionByStory = new Map<string, number>();

/**
 * Best-effort hygiene must not scan the whole log on every push: at most one compaction run per
 * story per hour. Process memory is enough for a throttle - the worst a restart causes is one
 * extra scan - and the map is bounded so a server that has ever seen many stories does not keep
 * them all.
 */
export function shouldCompactStoryNow(storyId: string, nowMs: number = Date.now()): boolean {
  const last = lastCompactionByStory.get(storyId);
  if (last !== undefined && nowMs - last < COMPACTION_MIN_INTERVAL_MS) return false;
  lastCompactionByStory.delete(storyId);
  lastCompactionByStory.set(storyId, nowMs);
  if (lastCompactionByStory.size > COMPACTION_THROTTLE_MAX_STORIES) {
    const oldest = lastCompactionByStory.keys().next();
    if (!oldest.done) lastCompactionByStory.delete(oldest.value);
  }
  return true;
}

/** Test seam for the process-memory throttle above. */
export function resetCompactionThrottle(): void {
  lastCompactionByStory.clear();
}

/**
 * Whether an applied Story update may have flipped `favoriteBehavior` (the only change that can
 * expose imported favorites with no operation logs). Reorders, deletes, creates, and unrelated
 * edits cannot - and the pull-time fingerprint repair self-heals anything this misses.
 */
export function storyUpdateFlipsFavorites(update: StoryUpdate): boolean {
  return (
    update.entity === 'Story' &&
    update.type === 'update' &&
    typeof (update as UpdateStoryUpdate).changes?.favoriteBehavior !== 'undefined'
  );
}

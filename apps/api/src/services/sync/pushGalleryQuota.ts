import type { CreateStoryUpdate, StoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { tierEnforcementService } from '../TierEnforcementService';

/**
 * Refuses gallery metadata that would breach the storage ceiling, with the same verdict as the
 * bytes upload. Storage quota counts the live rows' `sizeBytes`, so a create charges its full
 * size and an update charges only the increase (a shrinking row needs no check). Non-numeric
 * sizes fall through to the handler's validation, which rejects them for the right reason.
 *
 * Without this, the push accepted rows whose bytes the `/media` upload would then 403 - stranded
 * metadata with no path to ever heal.
 */
export async function assertGalleryStorageQuota(
  update: StoryUpdate,
  currentEntity: unknown,
  userId: string,
  storyId: string,
): Promise<void> {
  if (update.entity !== 'Gallery') {
    return;
  }
  if (update.type === 'create') {
    const sizeBytes = (update as CreateStoryUpdate).data?.sizeBytes;
    if (typeof sizeBytes === 'number' && Number.isFinite(sizeBytes) && sizeBytes > 0) {
      await tierEnforcementService.assertCanUploadMedia(userId, storyId, sizeBytes);
    }
    return;
  }
  if (update.type === 'update') {
    const nextSize = (update as UpdateStoryUpdate).changes?.sizeBytes;
    const prevSize = (currentEntity as { sizeBytes?: unknown })?.sizeBytes;
    if (typeof nextSize === 'number' && typeof prevSize === 'number' && nextSize > prevSize) {
      await tierEnforcementService.assertCanUploadMedia(userId, storyId, nextSize - prevSize);
    }
  }
}

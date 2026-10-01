import type { CreateStoryUpdate, StoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { mediaBlobs } from '../../db/schema';
import { tierEnforcementService } from '../TierEnforcementService';

/** What a row of this hash will really weigh: the stored blob's size, or the declared one until then. */
async function chargedSize(hash: unknown, declared: unknown): Promise<number> {
  if (typeof hash === 'string' && hash.length > 0) {
    const blob = await db.query.mediaBlobs.findFirst({
      where: eq(mediaBlobs.hash, hash),
      columns: { sizeBytes: true },
    });
    if (blob) return blob.sizeBytes;
  }
  return typeof declared === 'number' && Number.isFinite(declared) && declared > 0 ? declared : 0;
}

/**
 * Refuses gallery metadata that would breach the storage ceiling, with the same verdict as the
 * bytes upload. The ledger counts live rows at their blob's true size (the declared size only
 * until the bytes arrive), so a create charges its row, a restore charges it again (the row
 * leaves the ledger while deleted), and an update charges only the increase - of the true size
 * when it repoints to another stored blob. Non-numeric sizes fall through to the handler's
 * validation, which rejects them for the right reason.
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
    const data = (update as CreateStoryUpdate).data;
    const size = await chargedSize(data?.hash, data?.sizeBytes);
    if (size > 0) await tierEnforcementService.assertCanUploadMedia(userId, storyId, size);
    return;
  }
  if (update.type !== 'update') return;
  const changes = (update as UpdateStoryUpdate).changes ?? {};
  const current = (currentEntity ?? {}) as {
    hash?: unknown;
    sizeBytes?: unknown;
    isDeleted?: unknown;
  };
  const nextSize = await chargedSize(
    changes.hash ?? current.hash,
    changes.sizeBytes ?? current.sizeBytes,
  );
  const restoring = current.isDeleted === true && changes.isDeleted === false;
  const prevSize = restoring ? 0 : await chargedSize(current.hash, current.sizeBytes);
  if (nextSize > prevSize) {
    await tierEnforcementService.assertCanUploadMedia(userId, storyId, nextSize - prevSize);
  }
}

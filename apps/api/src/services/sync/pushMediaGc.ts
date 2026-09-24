import type { StoryUpdate } from '@keres/shared';
import { logger } from '../../utils/logger';
import { mediaStorageService } from '../MediaStorageService';

/**
 * Collects media blobs orphaned by an applied push operation. It runs after the operation's
 * transaction commits - never inside it - for two reasons that both bite when the collection
 * lives in the handlers:
 *
 * - Inside the transaction, the check reads through the global connection while the tombstone is
 *   still uncommitted, so it sees the row as live and silently skips every collection. Media
 *   deleted through a push leaked its bytes on every dialect.
 * - If the bytes were deleted first and the transaction then rolled back, the reference would come
 *   back to life with no bytes behind it - a silent, permanent loss no client would ever re-upload,
 *   since every one of them believes the server already has the file.
 *
 * Best-effort like compaction: a failure here leaks bytes but must never fail the push that just
 * succeeded.
 */
/**
 * The pre-operation row's hash, if it carries one. Only gallery rows do; anything else (or a
 * missing row) simply has nothing to collect.
 */
function hashOf(row: unknown): string | undefined {
  if (typeof row !== 'object' || row === null) {
    return undefined;
  }
  const hash = (row as { hash?: unknown }).hash;
  return typeof hash === 'string' ? hash : undefined;
}

export async function collectPushMediaGarbage(update: StoryUpdate, preRow: unknown): Promise<void> {
  try {
    if (update.entity === 'Gallery' && update.type === 'delete') {
      const hash = hashOf(preRow);
      if (hash) {
        await mediaStorageService.deleteBlobIfUnreferenced(hash);
      }
    } else if (update.entity === 'Gallery' && update.type === 'update') {
      const nextHash = (update.changes as { hash?: unknown }).hash;
      const previousHash = hashOf(preRow);
      if (typeof nextHash === 'string' && previousHash && nextHash !== previousHash) {
        await mediaStorageService.deleteBlobIfUnreferenced(previousHash);
      }
    } else if (update.entity === 'Story' && update.type === 'delete') {
      await mediaStorageService.deleteBlobsUnreferencedByStory(update.id);
    }
  } catch (error) {
    logger.error('SyncService: post-commit media collection failed', error);
  }
}

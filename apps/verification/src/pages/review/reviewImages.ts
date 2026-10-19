import type { ServiceState } from '../../routes';
import { BlobUnreadable, parseBlobs, readBlob } from '../../store/blobs';
import type { BlobRole } from '../../store/submissions';
import { bareResponse } from '../http';
import { sniffImage } from '../images';
import { claimedItem } from './itemActions';
import type { ReviewSession } from './session';

/**
 * The images of a sending, for the claimer's screen. Each request decrypts one image, writes one audit line (who, which
 * image, when; never its content) and answers with the bytes. The answer is no-store, is sent as what its bytes say
 * (sniffed again here, so a stored name or type is never trusted), and is sandboxed so it can run nothing even if
 * someone opens it directly.
 */

export type ReviewImage = { role: BlobRole; action: 'view-document' | 'view-photo' };

export function imageResponse(
  state: ServiceState,
  session: ReviewSession | undefined,
  submissionId: string,
  image: ReviewImage,
): Response {
  // Anyone but the claimer, and any closed sending, gets nothing to look at: the same empty answer.
  if (!session) return bareResponse(403);
  const now = state.clock();
  const row = claimedItem(state, submissionId, session.reviewer.id, now);
  if (!row) return bareResponse(404);
  if (!parseBlobs(row.blobsJson).some((blob) => blob.role === image.role)) return bareResponse(404);

  // The line goes first: a view that fails to decrypt is still a view someone asked for.
  state.stores.audit.record({
    at: now,
    reviewerId: session.reviewer.id,
    submissionId,
    action: image.action,
  });
  let bytes: Uint8Array | undefined;
  try {
    bytes = readBlob(state.stores, submissionId, image.role);
  } catch (error) {
    if (!(error instanceof BlobUnreadable)) throw error;
    return bareResponse(404);
  }
  const contentType = bytes ? sniffImage(bytes) : undefined;
  if (!bytes || !contentType) return bareResponse(404);
  // A copy with a plain ArrayBuffer behind it: the response body type takes no shared buffers.
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-disposition': 'inline',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
}

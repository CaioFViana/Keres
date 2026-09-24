import { and, eq, inArray, isNotNull, lt } from 'drizzle-orm';
import { db } from '../db';
import { galleries, mediaBlobs, stories } from '../db/schema';
import type { BlobStorage } from './media-storage/BlobStorage';
import { createBlobStorage } from './media-storage/createBlobStorage';

/**
 * How long bytes survive after their last live reference disappears. It covers the human
 * timescales of "delete, then change your mind": a conflict resolution that keeps the media, a
 * re-import of the same file, an undo. Seven days of a deleted photo's disk is cheap; the bytes
 * being gone when the reference comes back is permanent.
 */
export const MEDIA_BLOB_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/** The bytes do not hash to the declared digest: invalid client data, not a server failure. */
export class MediaHashMismatchError extends Error {
  constructor(expectedHash: string, actualHash: string) {
    super(
      `Media hash mismatch: declared ${expectedHash}, received content hashes to ${actualHash}.`,
    );
    this.name = 'MediaHashMismatchError';
  }
}

/**
 * Metadata and lifecycle of the gallery's blobs. The physical backend can be the plain local folder
 * or an S3-compatible endpoint; authorization stays exclusively in the media route.
 */
export class MediaStorageService {
  constructor(private readonly blobStorage: BlobStorage = createBlobStorage()) {}

  /** A stable key, compatible with the existing local layout. */
  private storageKeyFor(hash: string): string {
    if (!/^[a-f0-9]{32}$/.test(hash)) {
      throw new Error(`Invalid media hash: ${hash}`);
    }
    return `${hash.slice(0, 2)}/${hash}`;
  }

  async has(hash: string): Promise<boolean> {
    const record = await db.query.mediaBlobs.findFirst({ where: eq(mediaBlobs.hash, hash) });
    return !!record && this.blobStorage.has(record.storagePath);
  }

  async filterPresent(hashes: string[]): Promise<{ present: string[]; missing: string[] }> {
    const results: Array<{ hash: string; present: boolean }> = [];
    // The route accepts up to 500 hashes. On S3 each one becomes a remote call, so we cap the concurrency
    // to avoid an unnecessary spike at the provider or on the server.
    for (let start = 0; start < hashes.length; start += 20) {
      const batch = hashes.slice(start, start + 20);
      results.push(
        ...(await Promise.all(
          batch.map(async (hash) => ({ hash, present: await this.has(hash) })),
        )),
      );
    }
    return {
      present: results.filter((result) => result.present).map((result) => result.hash),
      missing: results.filter((result) => !result.present).map((result) => result.hash),
    };
  }

  /**
   * Presence scoped to one story: only hashes a live gallery row of *this* story points at are
   * ever reported as present. Storage is deduplicated globally, so an ungated answer would let any
   * reader of any story probe whether somebody else's bytes exist on the server just by knowing
   * the hash - the same reason downloads require a reference.
   *
   * Answering "missing" for the gated-out hashes is safe for the uploader: sending bytes the
   * server already holds is a deduplicated no-op, never a duplicate.
   */
  async filterPresentInStory(
    storyId: string,
    hashes: string[],
  ): Promise<{ present: string[]; missing: string[] }> {
    if (hashes.length === 0) {
      return { present: [], missing: [] };
    }
    const rows = await db
      .selectDistinct({ hash: galleries.hash })
      .from(galleries)
      .where(
        and(
          eq(galleries.storyId, storyId),
          inArray(galleries.hash, hashes),
          eq(galleries.isDeleted, false),
        ),
      );
    const referenced = new Set(rows.map((row) => row.hash));
    const { present } = await this.filterPresent(hashes.filter((hash) => referenced.has(hash)));
    const presentSet = new Set(present);
    return { present, missing: hashes.filter((hash) => !presentSet.has(hash)) };
  }

  async store(
    expectedHash: string,
    mimeType: string,
    bytes: ArrayBuffer,
  ): Promise<{ hash: string; sizeBytes: number }> {
    const actualHash = new Bun.CryptoHasher('md5').update(bytes).digest('hex');
    if (actualHash !== expectedHash) {
      throw new MediaHashMismatchError(expectedHash, actualHash);
    }

    const storagePath = this.storageKeyFor(actualHash);
    // Registering first avoids an orphaned final file if the database fails. Until the physical backend
    // receives the bytes, `has()` keeps answering "missing" and the client can resend.
    await db
      .insert(mediaBlobs)
      .values({
        hash: actualHash,
        mimeType,
        sizeBytes: bytes.byteLength,
        storagePath,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
    await this.blobStorage.put(storagePath, bytes, mimeType);

    return { hash: actualHash, sizeBytes: bytes.byteLength };
  }

  /** A hash is only downloadable when some live gallery row of *this* story points at it. */
  async isReferencedInStory(storyId: string, hash: string): Promise<boolean> {
    const referenced = await db.query.galleries.findFirst({
      where: and(
        eq(galleries.storyId, storyId),
        eq(galleries.hash, hash),
        eq(galleries.isDeleted, false),
      ),
      columns: { id: true },
    });
    return !!referenced;
  }

  async read(hash: string): Promise<{
    body: Blob | ReadableStream<Uint8Array>;
    mimeType: string;
    sizeBytes: number;
  } | null> {
    const record = await db.query.mediaBlobs.findFirst({ where: eq(mediaBlobs.hash, hash) });
    if (!record) {
      return null;
    }
    const body = await this.blobStorage.get(record.storagePath);
    return body ? { body, mimeType: record.mimeType, sizeBytes: record.sizeBytes } : null;
  }

  async deleteBlobIfUnreferenced(hash: string): Promise<void> {
    const record = await db.query.mediaBlobs.findFirst({ where: eq(mediaBlobs.hash, hash) });
    if (!record) {
      return;
    }

    const stillReferenced = await db
      .select({ id: galleries.id })
      .from(galleries)
      .innerJoin(stories, eq(galleries.storyId, stories.id))
      .where(
        and(eq(galleries.hash, hash), eq(galleries.isDeleted, false), eq(stories.isDeleted, false)),
      )
      .limit(1);
    if (stillReferenced.length > 0) {
      // A resurrection (a conflict resolution that kept the media, a re-import): the grace stamp
      // dies with it, even if the reference landed while the blob was already expired - the sweep
      // below re-checks here before deleting anything, so a stamp can never outlive its reference.
      if (record.unreferencedSince) {
        await db
          .update(mediaBlobs)
          .set({ unreferencedSince: null })
          .where(eq(mediaBlobs.hash, hash));
      }
      return;
    }

    if (!record.unreferencedSince) {
      await db
        .update(mediaBlobs)
        .set({ unreferencedSince: new Date() })
        .where(eq(mediaBlobs.hash, hash));
      return;
    }
    if (Date.now() - record.unreferencedSince.getTime() < MEDIA_BLOB_GRACE_PERIOD_MS) {
      return;
    }
    await this.blobStorage.delete(record.storagePath);
    await db.delete(mediaBlobs).where(eq(mediaBlobs.hash, hash));
  }

  /**
   * Deletes the blobs whose grace period expired, bounded per run. The scheduled counterpart of
   * `deleteBlobIfUnreferenced`: that one stamps newly orphaned blobs on the push path, this one
   * reaps them once nobody has re-referenced them for the whole grace period. Each candidate is
   * re-checked (references first) rather than deleted blindly, so a reference that landed after
   * the stamp still saves its bytes.
   *
   * @returns how many candidate blobs were examined, for logging.
   */
  async sweepExpiredUnreferencedBlobs(limit = 100): Promise<number> {
    const expired = await db
      .select({ hash: mediaBlobs.hash })
      .from(mediaBlobs)
      .where(
        and(
          isNotNull(mediaBlobs.unreferencedSince),
          lt(mediaBlobs.unreferencedSince, new Date(Date.now() - MEDIA_BLOB_GRACE_PERIOD_MS)),
        ),
      )
      .limit(limit);
    for (const { hash } of expired) {
      await this.deleteBlobIfUnreferenced(hash);
    }
    return expired.length;
  }

  /**
   * Collects every blob that belonged to a deleted story. A story's tombstone does not propagate
   * to its galleries (each entity synchronizes its own tombstone independently), so without this
   * sweep every hash that story ever referenced would be orphaned on disk as soon as the story
   * disappeared from everyone's view.
   */
  async deleteBlobsUnreferencedByStory(storyId: string): Promise<void> {
    const referencedHashes = await db
      .selectDistinct({ hash: galleries.hash })
      .from(galleries)
      .where(eq(galleries.storyId, storyId));
    for (const { hash } of referencedHashes) {
      await this.deleteBlobIfUnreferenced(hash);
    }
  }

  async cleanupTemporaryFiles(): Promise<number> {
    // An hour is far beyond a normal upload's duration, but it avoids deleting a file in flight after a
    // restart that happened too close to it.
    return this.blobStorage.cleanupTemporaryFiles?.(60 * 60 * 1000) ?? 0;
  }
}

export const mediaStorageService = new MediaStorageService();

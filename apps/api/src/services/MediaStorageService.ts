import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { galleries, mediaBlobs, stories } from '../db/schema';
import type { BlobStorage } from './media-storage/BlobStorage';
import { createBlobStorage } from './media-storage/createBlobStorage';

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

  async store(
    expectedHash: string,
    mimeType: string,
    bytes: ArrayBuffer,
  ): Promise<{ hash: string; sizeBytes: number }> {
    const actualHash = new Bun.CryptoHasher('md5').update(bytes).digest('hex');
    if (actualHash !== expectedHash) {
      throw new Error(
        `Media hash mismatch: declared ${expectedHash}, received content hashes to ${actualHash}.`,
      );
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
    const stillReferenced = await db
      .select({ id: galleries.id })
      .from(galleries)
      .innerJoin(stories, eq(galleries.storyId, stories.id))
      .where(
        and(eq(galleries.hash, hash), eq(galleries.isDeleted, false), eq(stories.isDeleted, false)),
      )
      .limit(1);
    if (stillReferenced.length > 0) {
      return;
    }

    const record = await db.query.mediaBlobs.findFirst({ where: eq(mediaBlobs.hash, hash) });
    if (!record) {
      return;
    }
    await this.blobStorage.delete(record.storagePath);
    await db.delete(mediaBlobs).where(eq(mediaBlobs.hash, hash));
  }

  async cleanupTemporaryFiles(): Promise<number> {
    // An hour is far beyond a normal upload's duration, but it avoids deleting a file in flight after a
    // restart that happened too close to it.
    return this.blobStorage.cleanupTemporaryFiles?.(60 * 60 * 1000) ?? 0;
  }
}

export const mediaStorageService = new MediaStorageService();

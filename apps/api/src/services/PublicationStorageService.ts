import type { BlobStorage } from './media-storage/BlobStorage';
import { createBlobStorage } from './media-storage/createBlobStorage';

/**
 * Where the .zip files of published versions live.
 *
 * It uses the same `createBlobStorage()` as media - so a server configured with
 * `MEDIA_STORAGE_DRIVER=s3` already keeps publications in S3, which is where they belong: they are
 * the largest objects this API produces. No new environment variable.
 *
 * Outside `MediaStorageService` on purpose: there, blobs are addressed by MD5, deduplicated
 * globally, counted against the tier's quota and collected by `deleteBlobIfUnreferenced`. A
 * publication package is none of that - it is a unique artifact, with its own owner and lifetime,
 * deleted along with the row that describes it.
 */
export class PublicationStorageService {
  constructor(private readonly blobStorage: BlobStorage = createBlobStorage()) {}

  storageKeyFor(storyId: string, publicationId: string): string {
    return `publications/${storyId}/${publicationId}.zip`;
  }

  async store(storyId: string, publicationId: string, bytes: Uint8Array): Promise<void> {
    await this.blobStorage.put(
      this.storageKeyFor(storyId, publicationId),
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      'application/zip',
    );
  }

  async read(storyId: string, publicationId: string) {
    return this.blobStorage.get(this.storageKeyFor(storyId, publicationId));
  }

  /**
   * A short-lived signed URL, when the backend supports it (S3). `null` on local disk, and then the
   * caller serves the bytes normally.
   */
  async presignedUrl(
    storyId: string,
    publicationId: string,
    ttlSeconds: number,
  ): Promise<string | null> {
    if (!this.blobStorage.presignGet) {
      return null;
    }
    return this.blobStorage.presignGet(this.storageKeyFor(storyId, publicationId), ttlSeconds);
  }

  async delete(storyId: string, publicationId: string): Promise<void> {
    await this.blobStorage.delete(this.storageKeyFor(storyId, publicationId));
  }
}

export const publicationStorageService = new PublicationStorageService();

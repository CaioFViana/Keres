/** The physical backend for media bytes. Metadata, authorization and deduplication stay in the service above it. */
export type BlobBody = Blob | ReadableStream<Uint8Array>;

export interface BlobStorage {
  has(key: string): Promise<boolean>;
  put(key: string, bytes: ArrayBuffer, mimeType: string): Promise<void>;
  get(key: string): Promise<BlobBody | null>;
  delete(key: string): Promise<void>;
  /** Optional because only the disk backend has local temporary uploads. */
  cleanupTemporaryFiles?(olderThanMs: number): Promise<number>;
  /**
   * A temporary URL the browser can fetch straight from storage, without going through the API.
   *
   * Optional because it only makes sense on a remote backend: local disk has no public address to sign,
   * and the caller handles its absence by falling back to serving the bytes. It exists so downloading a
   * publication (a large, potentially popular .zip) does not turn the API process into the bandwidth
   * bottleneck - which is precisely the reason for using S3.
   */
  presignGet?(key: string, ttlSeconds: number): Promise<string>;
}

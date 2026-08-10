/** Backend físico dos bytes de mídia. Metadados, autorização e deduplicação seguem no serviço acima dele. */
export type BlobBody = Blob | ReadableStream<Uint8Array>;

export interface BlobStorage {
  has(key: string): Promise<boolean>;
  put(key: string, bytes: ArrayBuffer, mimeType: string): Promise<void>;
  get(key: string): Promise<BlobBody | null>;
  delete(key: string): Promise<void>;
  /** Opcional porque só o backend de disco possui uploads temporários locais. */
  cleanupTemporaryFiles?(olderThanMs: number): Promise<number>;
}

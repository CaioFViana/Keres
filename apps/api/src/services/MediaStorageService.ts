import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { galleries, mediaBlobs, stories } from '../db/schema';
import type { BlobStorage } from './media-storage/BlobStorage';
import { createBlobStorage } from './media-storage/createBlobStorage';

/**
 * Metadados e ciclo de vida dos blobs de galeria. O backend físico pode ser a pasta local
 * simples ou um endpoint S3 compatível; autorização continua exclusivamente na rota de mídia.
 */
export class MediaStorageService {
  constructor(private readonly blobStorage: BlobStorage = createBlobStorage()) {}

  /** Chave estável e compatível com o layout local já existente. */
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
    // A rota aceita até 500 hashes. Em S3 cada um vira uma chamada remota, então limitamos a
    // concorrência para não produzir um pico desnecessário no provedor nem no servidor.
    for (let start = 0; start < hashes.length; start += 20) {
      const batch = hashes.slice(start, start + 20);
      results.push(...await Promise.all(batch.map(async (hash) => ({ hash, present: await this.has(hash) }))));
    }
    return {
      present: results.filter((result) => result.present).map((result) => result.hash),
      missing: results.filter((result) => !result.present).map((result) => result.hash),
    };
  }

  async store(expectedHash: string, mimeType: string, bytes: ArrayBuffer): Promise<{ hash: string; sizeBytes: number }> {
    const actualHash = new Bun.CryptoHasher('md5').update(bytes).digest('hex');
    if (actualHash !== expectedHash) {
      throw new Error(`Media hash mismatch: declared ${expectedHash}, received content hashes to ${actualHash}.`);
    }

    const storagePath = this.storageKeyFor(actualHash);
    // Registrar primeiro evita um arquivo final órfão se o banco falhar. Até o backend físico
    // receber os bytes, `has()` continua respondendo "missing" e o cliente pode reenviar.
    await db.insert(mediaBlobs).values({
      hash: actualHash,
      mimeType,
      sizeBytes: bytes.byteLength,
      storagePath,
      createdAt: new Date(),
    }).onConflictDoNothing();
    await this.blobStorage.put(storagePath, bytes, mimeType);

    return { hash: actualHash, sizeBytes: bytes.byteLength };
  }

  async read(hash: string): Promise<{ body: Blob | ReadableStream<Uint8Array>; mimeType: string; sizeBytes: number } | null> {
    const record = await db.query.mediaBlobs.findFirst({ where: eq(mediaBlobs.hash, hash) });
    if (!record) {
      return null;
    }
    const body = await this.blobStorage.get(record.storagePath);
    return body ? { body, mimeType: record.mimeType, sizeBytes: record.sizeBytes } : null;
  }

  async deleteBlobIfUnreferenced(hash: string): Promise<void> {
    const stillReferenced = await db.select({ id: galleries.id })
      .from(galleries)
      .innerJoin(stories, eq(galleries.storyId, stories.id))
      .where(and(eq(galleries.hash, hash), eq(galleries.isDeleted, false), eq(stories.isDeleted, false)))
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
    // Uma hora é muito acima da duração normal de um upload, mas evita apagar um arquivo em
    // trânsito depois de uma reinicialização muito próxima.
    return this.blobStorage.cleanupTemporaryFiles?.(60 * 60 * 1000) ?? 0;
  }
}

export const mediaStorageService = new MediaStorageService();

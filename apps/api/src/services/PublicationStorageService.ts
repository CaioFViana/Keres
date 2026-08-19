import type { BlobStorage } from './media-storage/BlobStorage';
import { createBlobStorage } from './media-storage/createBlobStorage';

/**
 * Onde ficam os .zip das versões publicadas.
 *
 * Usa o mesmo `createBlobStorage()` da mídia - então um servidor configurado com
 * `MEDIA_STORAGE_DRIVER=s3` já guarda as publicações em S3, que é onde elas devem estar:
 * são os maiores objetos que esta API produz. Sem variável de ambiente nova.
 *
 * Fora de `MediaStorageService` de propósito: lá os blobs são endereçados por MD5,
 * deduplicados globalmente, contam na cota do tier e são coletados por
 * `deleteBlobIfUnreferenced`. Um pacote de publicação não é nada disso - é um artefato único,
 * com dono e tempo de vida próprios, apagado junto com a linha que o descreve.
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
   * URL assinada de curta duração, quando o backend suporta (S3). `null` no disco local, e aí
   * quem chama serve os bytes normalmente.
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

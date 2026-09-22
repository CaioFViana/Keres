import { AppError } from '../utils/errors';
import type { BlobStorage } from './media-storage/BlobStorage';
import { createBlobStorage } from './media-storage/createBlobStorage';

/** Single blob holding the public site's logo. One server, one logo, one key. */
export const SHOWCASE_LOGO_KEY = 'showcase/logo';

/** A logo is a small header image, not a media blob; anything larger is a client mistake. */
export const SHOWCASE_LOGO_MAX_BYTES = 512 * 1024;

/** Raster formats every browser decodes; SVG is excluded so a logo cannot carry scripts. */
export const SHOWCASE_LOGO_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export function validateShowcaseLogo(contentType: string, sizeBytes: number): void {
  if (!SHOWCASE_LOGO_CONTENT_TYPES.includes(contentType as (typeof SHOWCASE_LOGO_CONTENT_TYPES)[number])) {
    throw new AppError(415, `Unsupported logo type "${contentType}".`);
  }
  if (sizeBytes > SHOWCASE_LOGO_MAX_BYTES) {
    throw new AppError(413, `Logo exceeds the maximum size of ${SHOWCASE_LOGO_MAX_BYTES} bytes.`);
  }
}

/**
 * Where the showcase logo bytes live.
 *
 * It uses the same `createBlobStorage()` as media and publications - no new environment variable -
 * but stays outside `MediaStorageService` on purpose: a logo is neither addressed by hash,
 * deduplicated, nor counted against quotas. The row in `showcase_settings` carries the content type
 * and the instant of the last upload; this service only moves the bytes.
 */
export class ShowcaseLogoStorageService {
  constructor(private readonly blobStorage: BlobStorage = createBlobStorage()) {}

  async store(bytes: ArrayBuffer, contentType: string): Promise<void> {
    validateShowcaseLogo(contentType, bytes.byteLength);
    // The local backend never overwrites a finished blob, so a replacement has to clear the key
    // first. Deleting an absent key is a no-op on both backends.
    await this.blobStorage.delete(SHOWCASE_LOGO_KEY);
    await this.blobStorage.put(SHOWCASE_LOGO_KEY, bytes, contentType);
  }

  async read() {
    return this.blobStorage.get(SHOWCASE_LOGO_KEY);
  }

  async delete(): Promise<void> {
    await this.blobStorage.delete(SHOWCASE_LOGO_KEY);
  }
}

export const showcaseLogoStorageService = new ShowcaseLogoStorageService();

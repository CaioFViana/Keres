import { describe, expect, it, vi } from 'vitest';
import type { BlobStorage } from '../../src/services/media-storage/BlobStorage';
import {
  SHOWCASE_LOGO_KEY,
  SHOWCASE_LOGO_MAX_BYTES,
  ShowcaseLogoStorageService,
} from '../../src/services/ShowcaseLogoStorageService';

/** In-memory backend: the same constructor injection `publicationStorageService.test.ts` uses. */
function memoryBackend() {
  const files = new Map<string, { bytes: ArrayBuffer; mimeType: string }>();
  const storage: BlobStorage = {
    has: vi.fn(async (key: string) => files.has(key)),
    put: vi.fn(async (key: string, bytes: ArrayBuffer, mimeType: string) => {
      files.set(key, { bytes, mimeType });
    }),
    get: vi.fn(async (key: string) => {
      const file = files.get(key);
      return file ? new Blob([file.bytes], { type: file.mimeType }) : null;
    }),
    delete: vi.fn(async (key: string) => {
      files.delete(key);
    }),
  };
  return { files, storage };
}

const pngBytes = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;

describe('ShowcaseLogoStorageService', () => {
  it('stores the logo under the single fixed key', async () => {
    const { files, storage } = memoryBackend();
    const service = new ShowcaseLogoStorageService(storage);

    await service.store(pngBytes(), 'image/png');

    expect(files.get(SHOWCASE_LOGO_KEY)?.mimeType).toBe('image/png');
    expect(storage.put).toHaveBeenCalledWith(
      SHOWCASE_LOGO_KEY,
      expect.any(ArrayBuffer),
      'image/png',
    );
  });

  it('replaces the previous logo instead of keeping the first upload', async () => {
    const { files, storage } = memoryBackend();
    const service = new ShowcaseLogoStorageService(storage);

    await service.store(pngBytes(), 'image/png');
    await service.store(new Uint8Array([0xff, 0xd8]).buffer, 'image/jpeg');

    expect(files.get(SHOWCASE_LOGO_KEY)?.mimeType).toBe('image/jpeg');
    expect(storage.delete).toHaveBeenCalledWith(SHOWCASE_LOGO_KEY);
  });

  it.each(['image/png', 'image/jpeg', 'image/webp'])('accepts %s', async (contentType) => {
    const { storage } = memoryBackend();
    const service = new ShowcaseLogoStorageService(storage);

    await service.store(pngBytes(), contentType);

    expect(storage.put).toHaveBeenCalledWith(
      SHOWCASE_LOGO_KEY,
      expect.any(ArrayBuffer),
      contentType,
    );
  });

  it.each(['image/svg+xml', 'image/gif', 'application/pdf', ''])(
    'rejects %s with 415 and stores nothing',
    async (contentType) => {
      const { files, storage } = memoryBackend();
      const service = new ShowcaseLogoStorageService(storage);

      await expect(service.store(pngBytes(), contentType)).rejects.toMatchObject({ status: 415 });
      expect(files.has(SHOWCASE_LOGO_KEY)).toBe(false);
      expect(storage.put).not.toHaveBeenCalled();
    },
  );

  it('accepts a logo of exactly 512KB and rejects anything larger with 413', async () => {
    const { storage } = memoryBackend();
    const service = new ShowcaseLogoStorageService(storage);

    await service.store(new ArrayBuffer(SHOWCASE_LOGO_MAX_BYTES), 'image/png');
    expect(storage.put).toHaveBeenCalledTimes(1);

    await expect(
      service.store(new ArrayBuffer(SHOWCASE_LOGO_MAX_BYTES + 1), 'image/png'),
    ).rejects.toMatchObject({ status: 413 });
    expect(storage.put).toHaveBeenCalledTimes(1);
  });

  it('reads back what was stored and null when no logo exists', async () => {
    const { storage } = memoryBackend();
    const service = new ShowcaseLogoStorageService(storage);

    await expect(service.read()).resolves.toBeNull();

    await service.store(pngBytes(), 'image/png');
    const body = await service.read();
    expect(body).toBeInstanceOf(Blob);
    expect((body as Blob).type).toBe('image/png');
  });

  it('deletes the logo', async () => {
    const { files, storage } = memoryBackend();
    const service = new ShowcaseLogoStorageService(storage);

    await service.store(pngBytes(), 'image/png');
    await service.delete();

    expect(files.has(SHOWCASE_LOGO_KEY)).toBe(false);
    await expect(service.read()).resolves.toBeNull();
  });
});

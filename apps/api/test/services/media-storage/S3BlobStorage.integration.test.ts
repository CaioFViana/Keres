import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

const shouldRun = process.env.RUN_S3_INTEGRATION === 'true';
const describeS3 = shouldRun ? describe : describe.skip;

describeS3('S3BlobStorage (SeaweedFS)', () => {
  let S3BlobStorage: typeof import('../../../src/services/media-storage/S3BlobStorage').S3BlobStorage;

  beforeAll(async () => {
    process.env.MEDIA_STORAGE_DRIVER = 's3';
    process.env.MEDIA_S3_ENDPOINT = process.env.S3_TEST_ENDPOINT ?? 'http://127.0.0.1:8333';
    process.env.MEDIA_S3_REGION = process.env.S3_TEST_REGION ?? 'us-east-1';
    process.env.MEDIA_S3_BUCKET = process.env.S3_TEST_BUCKET ?? 'my-bucket';
    process.env.MEDIA_S3_ACCESS_KEY_ID = process.env.S3_TEST_ACCESS_KEY_ID ?? 'admin';
    process.env.MEDIA_S3_SECRET_ACCESS_KEY = process.env.S3_TEST_SECRET_ACCESS_KEY ?? 'secret';
    process.env.MEDIA_S3_PREFIX = process.env.S3_TEST_PREFIX ?? 'keres-integration';
    process.env.MEDIA_S3_FORCE_PATH_STYLE = 'true';
    vi.resetModules();
    ({ S3BlobStorage } = await import('../../../src/services/media-storage/S3BlobStorage'));
  });

  afterAll(() => {
    for (const key of [
      'MEDIA_STORAGE_DRIVER', 'MEDIA_S3_ENDPOINT', 'MEDIA_S3_REGION', 'MEDIA_S3_BUCKET',
      'MEDIA_S3_ACCESS_KEY_ID', 'MEDIA_S3_SECRET_ACCESS_KEY', 'MEDIA_S3_PREFIX', 'MEDIA_S3_FORCE_PATH_STYLE',
    ]) {
      delete process.env[key];
    }
  });

  it('writes, reads, detects and deletes a real gallery image through the S3 API', async () => {
    const storage = new S3BlobStorage();
    const key = `test/${crypto.randomUUID()}`;
    const imagePath = path.resolve(import.meta.dirname, '../../../../client/assets/images/favicon.png');
    const image = await readFile(imagePath);
    const bytes = image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength) as ArrayBuffer;

    expect(await storage.has(key)).toBe(false);
    await storage.put(key, bytes, 'image/png');
    expect(await storage.has(key)).toBe(true);

    const body = await storage.get(key);
    expect(body).not.toBeNull();
    expect(new Uint8Array(await new Response(body!).arrayBuffer())).toEqual(new Uint8Array(bytes));

    await storage.delete(key);
    expect(await storage.has(key)).toBe(false);
  });
});

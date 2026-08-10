import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const shouldRun = process.env.RUN_S3_INTEGRATION === 'true';
const describeS3 = shouldRun ? describe : describe.skip;

describeS3('S3BlobStorage (SeaweedFS)', () => {
  let S3BlobStorage: typeof import('../../../src/services/media-storage/S3BlobStorage').S3BlobStorage;

  beforeAll(async () => {
    process.env.MEDIA_STORAGE_DRIVER = 's3';
    process.env.MEDIA_S3_ENDPOINT = 'http://127.0.0.1:8333';
    process.env.MEDIA_S3_REGION = 'us-east-1';
    process.env.MEDIA_S3_BUCKET = 'keres-media';
    process.env.MEDIA_S3_ACCESS_KEY_ID = 'keres-test';
    process.env.MEDIA_S3_SECRET_ACCESS_KEY = 'keres-test-secret';
    process.env.MEDIA_S3_PREFIX = 'integration';
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

  it('writes, reads, detects and deletes an object through the S3 API', async () => {
    const storage = new S3BlobStorage();
    const key = `test/${crypto.randomUUID()}`;
    const bytes = new TextEncoder().encode('SeaweedFS S3 integration').buffer;

    expect(await storage.has(key)).toBe(false);
    await storage.put(key, bytes, 'text/plain');
    expect(await storage.has(key)).toBe(true);

    const body = await storage.get(key);
    expect(body).not.toBeNull();
    expect(await new Response(body!).text()).toBe('SeaweedFS S3 integration');

    await storage.delete(key);
    expect(await storage.has(key)).toBe(false);
  });
});

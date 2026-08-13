import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clientConfig: undefined as unknown,
  send: vi.fn(),
}));

vi.mock('../../../src/config/env', () => ({
  env: {
    MEDIA_S3_ENDPOINT: 'http://s3.local', MEDIA_S3_REGION: 'sa-east-1', MEDIA_S3_FORCE_PATH_STYLE: true,
    MEDIA_S3_ACCESS_KEY_ID: 'access', MEDIA_S3_SECRET_ACCESS_KEY: 'secret', MEDIA_S3_BUCKET: 'keres-media', MEDIA_S3_PREFIX: '/uploads/',
  },
}));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    constructor(config: unknown) { mocks.clientConfig = config; }
    send = mocks.send;
  },
  HeadObjectCommand: class { constructor(public input: unknown) {} },
  PutObjectCommand: class { constructor(public input: unknown) {} },
  GetObjectCommand: class { constructor(public input: unknown) {} },
  DeleteObjectCommand: class { constructor(public input: unknown) {} },
}));

import { S3BlobStorage } from '../../../src/services/media-storage/S3BlobStorage';

beforeEach(() => vi.clearAllMocks());

describe('S3BlobStorage', () => {
  it('uses the configured compatible-S3 endpoint and prefixes object keys', async () => {
    const storage = new S3BlobStorage();
    mocks.send.mockResolvedValue({});

    await expect(storage.has('media/story-1/image.png')).resolves.toBe(true);

    expect(mocks.clientConfig).toMatchObject({ endpoint: 'http://s3.local', region: 'sa-east-1', forcePathStyle: true });
    expect(mocks.send.mock.calls[0][0].input).toEqual({ Bucket: 'keres-media', Key: 'uploads/media/story-1/image.png' });
  });

  it('treats a missing head request as an absent blob, but preserves unexpected failures', async () => {
    const storage = new S3BlobStorage();
    mocks.send.mockRejectedValueOnce({ name: 'NotFound' }).mockRejectedValueOnce(new Error('S3 unavailable'));

    await expect(storage.has('missing')).resolves.toBe(false);
    await expect(storage.has('broken')).rejects.toThrow('S3 unavailable');
  });

  it('uploads bytes with the declared mime type and deletes the same prefixed key', async () => {
    const storage = new S3BlobStorage();
    mocks.send.mockResolvedValue({});
    const bytes = new Uint8Array([1, 2, 3]).buffer;

    await storage.put('a.png', bytes, 'image/png');
    await storage.delete('a.png');

    expect(mocks.send.mock.calls[0][0].input).toMatchObject({ Bucket: 'keres-media', Key: 'uploads/a.png', ContentType: 'image/png', Body: new Uint8Array([1, 2, 3]) });
    expect(mocks.send.mock.calls[1][0].input).toEqual({ Bucket: 'keres-media', Key: 'uploads/a.png' });
  });

  it('returns a web stream when an object has a body and null when it does not exist', async () => {
    const stream = new ReadableStream<Uint8Array>();
    const transformToWebStream = vi.fn(() => stream);
    const storage = new S3BlobStorage();
    mocks.send.mockResolvedValueOnce({ Body: { transformToWebStream } }).mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });

    await expect(storage.get('a.png')).resolves.toBe(stream);
    await expect(storage.get('missing.png')).resolves.toBeNull();
  });

  it('returns null for an empty S3 response and preserves unexpected read failures', async () => {
    const storage = new S3BlobStorage();
    mocks.send.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('S3 unavailable'));

    await expect(storage.get('empty.png')).resolves.toBeNull();
    await expect(storage.get('broken.png')).rejects.toThrow('S3 unavailable');
  });
});

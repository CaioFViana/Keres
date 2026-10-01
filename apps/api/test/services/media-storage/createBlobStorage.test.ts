import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/env', () => ({
  env: {
    MEDIA_STORAGE_DRIVER: 'local',
    MEDIA_STORAGE_PATH: '/tmp/keres-media-test',
    MEDIA_S3_ENDPOINT: undefined,
    MEDIA_S3_REGION: 'sa-east-1',
    MEDIA_S3_FORCE_PATH_STYLE: false,
    MEDIA_S3_ACCESS_KEY_ID: 'access',
    MEDIA_S3_SECRET_ACCESS_KEY: 'secret',
    MEDIA_S3_BUCKET: 'keres-media',
    MEDIA_S3_PREFIX: '',
  },
}));

import { env } from '../../../src/config/env';
import { createBlobStorage } from '../../../src/services/media-storage/createBlobStorage';
import { LocalFilesystemBlobStorage } from '../../../src/services/media-storage/LocalFilesystemBlobStorage';
import { S3BlobStorage } from '../../../src/services/media-storage/S3BlobStorage';

describe('createBlobStorage', () => {
  it('builds a local backend by default and an S3 backend when configured', () => {
    env.MEDIA_STORAGE_DRIVER = 'local';
    expect(createBlobStorage()).toBeInstanceOf(LocalFilesystemBlobStorage);

    env.MEDIA_STORAGE_DRIVER = 's3';
    expect(createBlobStorage()).toBeInstanceOf(S3BlobStorage);

    env.MEDIA_STORAGE_DRIVER = 'local';
  });
});

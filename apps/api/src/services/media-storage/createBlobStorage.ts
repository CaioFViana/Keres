import { env } from '../../config/env';
import type { BlobStorage } from './BlobStorage';
import { LocalFilesystemBlobStorage } from './LocalFilesystemBlobStorage';
import { S3BlobStorage } from './S3BlobStorage';

export function createBlobStorage(): BlobStorage {
  return env.MEDIA_STORAGE_DRIVER === 's3'
    ? new S3BlobStorage()
    : new LocalFilesystemBlobStorage(env.MEDIA_STORAGE_PATH);
}

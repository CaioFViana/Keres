import { count, eq } from 'drizzle-orm';
import * as path from 'node:path';
import { env } from '../config/env';
import { db } from '../db';
import {
  MEDIA_STORAGE_SETTINGS_SINGLETON_ID,
  mediaBlobs,
  mediaStorageSettings,
} from '../db/schema';

export function configuredMediaStorageIdentity(): string {
  if (env.MEDIA_STORAGE_DRIVER === 'local') {
    return `local:${path.resolve(env.MEDIA_STORAGE_PATH)}`;
  }

  const endpoint = env.MEDIA_S3_ENDPOINT
    ? new URL(env.MEDIA_S3_ENDPOINT).toString().replace(/\/$/, '')
    : 'aws';
  const prefix = env.MEDIA_S3_PREFIX.replace(/^\/+|\/+$/g, '');
  return `s3:${endpoint}:${env.MEDIA_S3_REGION}:${env.MEDIA_S3_BUCKET}:${prefix}:${env.MEDIA_S3_FORCE_PATH_STYLE ? 'path' : 'virtual'}`;
}

/** Run before the API accepts traffic; it never changes the media source silently. */
export async function assertMediaStorageConfiguration(): Promise<void> {
  const identity = configuredMediaStorageIdentity();
  const setting = await db.query.mediaStorageSettings.findFirst({
    where: eq(mediaStorageSettings.id, MEDIA_STORAGE_SETTINGS_SINGLETON_ID),
  });

  if (!setting) {
    const [{ value: blobCount }] = await db.select({ value: count() }).from(mediaBlobs);
    // Databases created before this protection were necessarily local. We do not accept pointing them at
    // S3 by mistake just because the configuration table has only now appeared.
    if (Number(blobCount) > 0 && env.MEDIA_STORAGE_DRIVER !== 'local') {
      throw new Error(
        'This database already contains gallery media from the legacy local filesystem storage. ' +
          'Keep MEDIA_STORAGE_DRIVER=local, migrate the blobs explicitly, or initialize an empty database and storage.',
      );
    }
    await db
      .insert(mediaStorageSettings)
      .values({
        id: MEDIA_STORAGE_SETTINGS_SINGLETON_ID,
        storageIdentity: identity,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // Two containers can come up together. Re-read the row after the insert so the process that lost the
    // race does not start out pointing at a different backend.
    const persisted = await db.query.mediaStorageSettings.findFirst({
      where: eq(mediaStorageSettings.id, MEDIA_STORAGE_SETTINGS_SINGLETON_ID),
    });
    if (persisted?.storageIdentity !== identity) {
      throw new Error(
        `Gallery storage was initialized concurrently with "${persisted?.storageIdentity}" instead of "${identity}". ` +
          'Use one consistent media storage configuration across all API instances.',
      );
    }
    return;
  }

  if (setting.storageIdentity === identity) {
    return;
  }

  const [{ value: blobCount }] = await db.select({ value: count() }).from(mediaBlobs);
  if (Number(blobCount) === 0) {
    await db
      .update(mediaStorageSettings)
      .set({ storageIdentity: identity, updatedAt: new Date() })
      .where(eq(mediaStorageSettings.id, MEDIA_STORAGE_SETTINGS_SINGLETON_ID));
    return;
  }

  throw new Error(
    `Gallery storage configuration changed from "${setting.storageIdentity}" to "${identity}", ` +
      'but this database already contains media. Restore the previous configuration, run an explicit migration, ' +
      'or initialize an empty database and storage. The server will not switch media backends automatically.',
  );
}

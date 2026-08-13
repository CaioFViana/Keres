import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { MEDIA_STORAGE_SETTINGS_SINGLETON_ID, mediaBlobs, mediaStorageSettings } from '../../src/db/schema';
import { assertMediaStorageConfiguration, configuredMediaStorageIdentity } from '../../src/services/MediaStorageConfigurationService';
import { truncateAll } from '../helpers/database';

beforeEach(truncateAll);

describe('media storage configuration lock', () => {
  it('initializes an empty database with the current storage identity', async () => {
    await assertMediaStorageConfiguration();

    const setting = await db.query.mediaStorageSettings.findFirst({
      where: (fields, { eq }) => eq(fields.id, MEDIA_STORAGE_SETTINGS_SINGLETON_ID),
    });
    expect(setting?.storageIdentity).toBe(configuredMediaStorageIdentity());
  });

  it('repairs an old identity while there are no blobs to lose', async () => {
    await db.insert(mediaStorageSettings).values({
      id: MEDIA_STORAGE_SETTINGS_SINGLETON_ID,
      storageIdentity: 'local:/obsolete-path',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await assertMediaStorageConfiguration();

    const setting = await db.query.mediaStorageSettings.findFirst({
      where: (fields, { eq }) => eq(fields.id, MEDIA_STORAGE_SETTINGS_SINGLETON_ID),
    });
    expect(setting?.storageIdentity).toBe(configuredMediaStorageIdentity());
  });

  it('refuses a backend identity change once the database contains blobs', async () => {
    await db.insert(mediaStorageSettings).values({
      id: MEDIA_STORAGE_SETTINGS_SINGLETON_ID,
      storageIdentity: 'local:/obsolete-path',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(mediaBlobs).values({
      hash: 'a'.repeat(32), mimeType: 'image/png', sizeBytes: 1, storagePath: 'aa/blob', createdAt: new Date(),
    });

    await expect(assertMediaStorageConfiguration()).rejects.toThrow(/configuration changed/i);
  });
});

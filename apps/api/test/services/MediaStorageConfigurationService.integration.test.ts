import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env';
import { db } from '../../src/db';
import {
  MEDIA_STORAGE_SETTINGS_SINGLETON_ID,
  mediaBlobs,
  mediaStorageSettings,
} from '../../src/db/schema';
import {
  assertMediaStorageConfiguration,
  configuredMediaStorageIdentity,
} from '../../src/services/MediaStorageConfigurationService';
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

  it('leaves a matching configuration untouched', async () => {
    await db.insert(mediaStorageSettings).values({
      id: MEDIA_STORAGE_SETTINGS_SINGLETON_ID,
      storageIdentity: configuredMediaStorageIdentity(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const before = await db.query.mediaStorageSettings.findFirst({
      where: (fields, { eq }) => eq(fields.id, MEDIA_STORAGE_SETTINGS_SINGLETON_ID),
    });

    await assertMediaStorageConfiguration();
    await assertMediaStorageConfiguration();

    const after = await db.query.mediaStorageSettings.findFirst({
      where: (fields, { eq }) => eq(fields.id, MEDIA_STORAGE_SETTINGS_SINGLETON_ID),
    });
    expect(after?.storageIdentity).toBe(before?.storageIdentity);
    expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());
  });

  it('repairs an S3 identity chosen in the environment', async () => {
    const prior = {
      driver: env.MEDIA_STORAGE_DRIVER,
      endpoint: env.MEDIA_S3_ENDPOINT,
      bucket: env.MEDIA_S3_BUCKET,
    };
    env.MEDIA_STORAGE_DRIVER = 's3';
    env.MEDIA_S3_ENDPOINT = 'https://s3.test';
    env.MEDIA_S3_BUCKET = 'midias';
    try {
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
      expect(setting?.storageIdentity).toMatch(/^s3:https:\/\/s3\.test:/);
    } finally {
      env.MEDIA_STORAGE_DRIVER = prior.driver;
      env.MEDIA_S3_ENDPOINT = prior.endpoint;
      env.MEDIA_S3_BUCKET = prior.bucket;
    }
  });

  it('names the AWS default and path-style addressing in the S3 identity', () => {
    const prior = {
      driver: env.MEDIA_STORAGE_DRIVER,
      endpoint: env.MEDIA_S3_ENDPOINT,
      bucket: env.MEDIA_S3_BUCKET,
      pathStyle: env.MEDIA_S3_FORCE_PATH_STYLE,
    };
    env.MEDIA_STORAGE_DRIVER = 's3';
    env.MEDIA_S3_ENDPOINT = undefined;
    env.MEDIA_S3_BUCKET = 'midias';
    env.MEDIA_S3_FORCE_PATH_STYLE = true;
    try {
      expect(configuredMediaStorageIdentity()).toMatch(/^s3:aws:.*:path$/);
    } finally {
      env.MEDIA_STORAGE_DRIVER = prior.driver;
      env.MEDIA_S3_ENDPOINT = prior.endpoint;
      env.MEDIA_S3_BUCKET = prior.bucket;
      env.MEDIA_S3_FORCE_PATH_STYLE = prior.pathStyle;
    }
  });

  it('adopts a legacy database whose blobs predate the protection', async () => {
    await db.insert(mediaBlobs).values({
      hash: 'b'.repeat(32),
      mimeType: 'image/png',
      sizeBytes: 1,
      storagePath: 'bb/blob',
      createdAt: new Date(),
    });

    await assertMediaStorageConfiguration();

    const setting = await db.query.mediaStorageSettings.findFirst({
      where: (fields, { eq }) => eq(fields.id, MEDIA_STORAGE_SETTINGS_SINGLETON_ID),
    });
    expect(setting?.storageIdentity).toBe(configuredMediaStorageIdentity());
  });

  it('refuses a legacy identity loss against an S3 environment', async () => {
    const prior = {
      driver: env.MEDIA_STORAGE_DRIVER,
      endpoint: env.MEDIA_S3_ENDPOINT,
      bucket: env.MEDIA_S3_BUCKET,
    };
    env.MEDIA_STORAGE_DRIVER = 's3';
    env.MEDIA_S3_ENDPOINT = 'https://s3.test';
    env.MEDIA_S3_BUCKET = 'midias';
    try {
      await db.insert(mediaStorageSettings).values({
        id: MEDIA_STORAGE_SETTINGS_SINGLETON_ID,
        storageIdentity: 'local:/legacy-path',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(mediaBlobs).values({
        hash: 'c'.repeat(32),
        mimeType: 'image/png',
        sizeBytes: 1,
        storagePath: 'cc/blob',
        createdAt: new Date(),
      });

      await expect(assertMediaStorageConfiguration()).rejects.toThrow(/configuration changed/i);
    } finally {
      env.MEDIA_STORAGE_DRIVER = prior.driver;
      env.MEDIA_S3_ENDPOINT = prior.endpoint;
      env.MEDIA_S3_BUCKET = prior.bucket;
    }
  });

  it('refuses to point a legacy database at S3', async () => {
    const prior = {
      driver: env.MEDIA_STORAGE_DRIVER,
      bucket: env.MEDIA_S3_BUCKET,
    };
    env.MEDIA_STORAGE_DRIVER = 's3';
    env.MEDIA_S3_BUCKET = 'midias';
    try {
      await db.insert(mediaBlobs).values({
        hash: 'd'.repeat(32),
        mimeType: 'image/png',
        sizeBytes: 1,
        storagePath: 'dd/blob',
        createdAt: new Date(),
      });

      await expect(assertMediaStorageConfiguration()).rejects.toThrow(/legacy local filesystem/i);
    } finally {
      env.MEDIA_STORAGE_DRIVER = prior.driver;
      env.MEDIA_S3_BUCKET = prior.bucket;
    }
  });

  it('refuses a backend identity change once the database contains blobs', async () => {
    await db.insert(mediaStorageSettings).values({
      id: MEDIA_STORAGE_SETTINGS_SINGLETON_ID,
      storageIdentity: 'local:/obsolete-path',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(mediaBlobs).values({
      hash: 'a'.repeat(32),
      mimeType: 'image/png',
      sizeBytes: 1,
      storagePath: 'aa/blob',
      createdAt: new Date(),
    });

    await expect(assertMediaStorageConfiguration()).rejects.toThrow(/configuration changed/i);
  });
});

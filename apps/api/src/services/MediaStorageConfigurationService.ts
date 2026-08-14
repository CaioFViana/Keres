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

/** Executado antes da API aceitar tráfego; nunca muda a origem de mídia de forma silenciosa. */
export async function assertMediaStorageConfiguration(): Promise<void> {
  const identity = configuredMediaStorageIdentity();
  const setting = await db.query.mediaStorageSettings.findFirst({
    where: eq(mediaStorageSettings.id, MEDIA_STORAGE_SETTINGS_SINGLETON_ID),
  });

  if (!setting) {
    const [{ value: blobCount }] = await db.select({ value: count() }).from(mediaBlobs);
    // Bancos criados antes desta proteção já eram necessariamente locais. Não aceitamos
    // apontá-los para S3 por engano só porque a tabela de configuração acabou de surgir.
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

    // Dois containers podem subir juntos. Releia a linha após o insert para que o processo
    // que perdeu a corrida não comece apontando para outro backend.
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

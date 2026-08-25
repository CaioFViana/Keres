import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { createApp } from './index';
import { persistApiLog } from './services/ApiLogService';
import { assertMediaStorageConfiguration } from './services/MediaStorageConfigurationService';
import { mediaStorageService } from './services/MediaStorageService';
import { reconcileRootAdmin } from './services/RootAdminService';
import { logger, setLogSink } from './utils/logger';

export type ListeningAddress = { hostname: string; port: number };

/**
 * Production effects pulled out of `server.ts` so the launcher (and the tests) can start the API
 * without duplicating the order: migrations → persisted logs → media → admin → listen.
 */
export async function preparePersistence(): Promise<void> {
  await runMigrations();
  // Only after the migrations: the `api_logs` table may not exist yet on a first boot. The few logs
  // before this point stay console-only, which is acceptable.
  setLogSink(persistApiLog);
  await assertMediaStorageConfiguration();
  const abandonedMediaUploads = await mediaStorageService.cleanupTemporaryFiles();
  if (abandonedMediaUploads > 0) {
    logger.info(`Removed ${abandonedMediaUploads} abandoned temporary media upload(s).`);
  }
  await reconcileRootAdmin();
}

export async function bootAndListen(options?: {
  onListening?: (address: ListeningAddress) => void;
}): Promise<void> {
  try {
    await preparePersistence();
  } catch (error) {
    // Without this, a failure here (say, Postgres being down) came up as an unhandled rejection from Bun
    // itself - never passing through the structured `logger` the rest of the app uses, and never making it
    // clear that it was the boot that failed (rather than some request). Every failure here is fatal - the
    // API makes no sense without migrations/media config/admin reconciled - so it also brings the process
    // down explicitly instead of letting the unhandled exception decide.
    logger.error('Fatal error during startup', error);
    process.exit(1);
  }

  const app = await createApp();
  app.listen(
    {
      port: env.PORT,
      ...(env.HOST ? { hostname: env.HOST } : {}),
      // Bun buffers the whole request body into memory before any route code runs - the
      // MEDIA_MAX_BYTES check in media.route.ts only rejects an oversized upload *after* that
      // buffering already happened, which doesn't bound memory use at all. This cap runs first,
      // at the HTTP layer, before any handler (or auth) sees the request. 8MB of headroom over
      // MEDIA_MAX_BYTES covers multipart overhead; every other route's payloads (sync batches,
      // JSON bodies) are nowhere near this size in practice.
      maxRequestBodySize: env.MEDIA_MAX_BYTES + 8 * 1024 * 1024,
    },
    ({ hostname, port }) => {
      const address = {
        hostname: hostname ?? env.HOST ?? '0.0.0.0',
        port: port ?? Number(env.PORT),
      };
      logger.info(`Elysia is running at http://${address.hostname}:${address.port}`);
      logger.info(`Swagger UI at http://${address.hostname}:${address.port}/api/swagger`);
      options?.onListening?.(address);
    },
  );
}

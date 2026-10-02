import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { clientDistPath } from './config/resourceRoot';
import { createApp } from './index';
import { persistApiLog } from './services/ApiLogService';
import { pruneAttemptLimits } from './services/AttemptLimitService';
import { auditService } from './services/AuditService';
import { warmHostedClientDelivery } from './services/hostedClientDelivery';
import { assertMediaStorageConfiguration } from './services/MediaStorageConfigurationService';
import { mediaStorageService } from './services/MediaStorageService';
import { reconcileRootAdmin } from './services/RootAdminService';
import { normalizeStoredUserTags } from './services/UserTagMaintenance';
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
  // Before the root admin: its own tag, when it already exists, is one of those that may need it.
  await normalizeStoredUserTags();
  await reconcileRootAdmin();
}

/**
 * Periodically reaps media blobs whose grace period expired. Best-effort: a failed sweep only
 * delays disk reclamation to the next run, and candidates are re-checked (references first)
 * before anything is deleted, so overlapping runs - or two processes sweeping at once - can only
 * repeat idempotent work, never delete a referenced blob.
 */
function startMediaBlobSweepScheduler(): void {
  const sweep = () => {
    mediaStorageService
      .sweepExpiredUnreferencedBlobs()
      .then((examined) => {
        if (examined > 0) {
          logger.info(`Media blob sweep examined ${examined} expired blob(s).`);
        }
      })
      .catch((error: unknown) => {
        logger.error('Media blob sweep failed', error);
      });
  };
  // One early run collects whatever expired while the server was down; the hourly cadence bounds
  // how long past the grace period bytes linger.
  setTimeout(sweep, 60_000);
  setInterval(sweep, 60 * 60_000);
}

/**
 * Keeps the activity record to its retention: once at start (what aged while the server was down) and
 * daily after. Best-effort like the media sweep - a failed run only leaves old lines for the next one.
 */
function startAuditRetentionScheduler(): void {
  const prune = () => {
    auditService
      .prune()
      .then((removed) => {
        if (removed > 0) {
          logger.info(
            `Activity record: dropped ${removed} line(s) older than ${env.AUDIT_RETENTION_DAYS} days.`,
          );
        }
      })
      .catch((error: unknown) => {
        logger.error('Activity record retention failed', error);
      });
  };
  setTimeout(prune, 30_000);
  setInterval(prune, 24 * 60 * 60_000);
}

/** Drops the lockout counters whose window is long over: once at start and daily after, like the activity record. */
function startAttemptLimitPruneScheduler(): void {
  const prune = () => {
    pruneAttemptLimits().catch((error: unknown) => {
      logger.error('Attempt counter cleanup failed', error);
    });
  };
  setTimeout(prune, 45_000);
  setInterval(prune, 24 * 60 * 60_000);
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
  startMediaBlobSweepScheduler();
  startAuditRetentionScheduler();
  startAttemptLimitPruneScheduler();
  auditService.record({
    category: 'system',
    action: 'system.server_started',
    meta: { databaseDriver: env.DATABASE_DRIVER, port: env.PORT },
  });
  // After listening is not required, and it is not awaited: the server answers from the first second,
  // and the first visitor finds the client already compressed rather than waiting for it.
  void warmHostedClientDelivery(clientDistPath());
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

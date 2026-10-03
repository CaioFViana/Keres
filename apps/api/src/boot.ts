import { env } from './config/env';
import { closeDatabase } from './db';
import { runMigrations } from './db/migrate';
import { clientDistPath } from './config/resourceRoot';
import { createApp } from './index';
import { persistApiLog } from './services/ApiLogService';
import { pruneAttemptLimits } from './services/AttemptLimitService';
import { auditService } from './services/AuditService';
import { createConfiguredDemoPlugin, demoBaseUrl } from './services/payments/demo/DemoPayService';
import {
  getPaymentPlugin,
  loadPaymentPlugin,
  setPaymentPlugin,
} from './services/payments/PaymentPluginRegistry';
import { subscriptionService } from './services/payments/SubscriptionService';
import { warmHostedClientDelivery } from './services/hostedClientDelivery';
import { assertMediaStorageConfiguration } from './services/MediaStorageConfigurationService';
import { mediaStorageService } from './services/MediaStorageService';
import { registrationSettingsService } from './services/RegistrationSettingsService';
import { reconcileRootAdmin } from './services/RootAdminService';
import { normalizeStoredUserTags } from './services/UserTagMaintenance';
import { createShutdown, installShutdownHandlers } from './shutdown';
import { drainBackground, trackBackground } from './utils/backgroundWork';
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
 * A server that sells plans needs a default plan: it is where somebody goes when their paid period ends and no
 * plan was assigned to them. Without one they are not limited at all, so a lapsed subscription would be worth
 * more than a free plan. Said at every start, loudly, because nothing fails to make it visible otherwise.
 */
export async function warnIfPaymentsHaveNoDefaultPlan(): Promise<boolean> {
  if (!getPaymentPlugin()) return false;
  try {
    const { defaultTierId } = await registrationSettingsService.getOrCreate();
    if (defaultTierId) return false;
  } catch (error) {
    logger.warn('Could not check for a default plan', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
  logger.warn(
    'Payments are on but the server has no default plan: people whose paid period ends, and who have no plan assigned, will have NO limits. Set a default plan in the admin panel (Registration).',
  );
  return true;
}

/**
 * Periodically reaps media blobs whose grace period expired. Best-effort: a failed sweep only
 * delays disk reclamation to the next run, and candidates are re-checked (references first)
 * before anything is deleted, so overlapping runs - or two processes sweeping at once - can only
 * repeat idempotent work, never delete a referenced blob.
 */
function startMediaBlobSweepScheduler(): () => void {
  const sweep = () => {
    trackBackground(
      mediaStorageService
        .sweepExpiredUnreferencedBlobs()
        .then((examined) => {
          if (examined > 0) {
            logger.info(`Media blob sweep examined ${examined} expired blob(s).`);
          }
        })
        .catch((error: unknown) => {
          logger.error('Media blob sweep failed', error);
        }),
    );
  };
  // One early run collects whatever expired while the server was down; the hourly cadence bounds
  // how long past the grace period bytes linger.
  const first = setTimeout(sweep, 60_000);
  const every = setInterval(sweep, 60 * 60_000);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}

/**
 * Keeps the activity record to its retention: once at start (what aged while the server was down) and
 * daily after. Best-effort like the media sweep - a failed run only leaves old lines for the next one.
 */
function startAuditRetentionScheduler(): () => void {
  const prune = () => {
    trackBackground(
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
        }),
    );
  };
  const first = setTimeout(prune, 30_000);
  const every = setInterval(prune, 24 * 60 * 60_000);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}

/**
 * Marks the subscriptions whose paid period ran out (and closes the payment attempts nobody finished). Runs
 * whether or not a payment plugin is installed: what was paid keeps expiring on its date either way.
 */
function startPaymentsScheduler(): () => void {
  const run = () => {
    trackBackground(
      subscriptionService
        .markDue()
        .then(({ due, ended }) => {
          if (due > 0 || ended > 0) {
            logger.info(`Payments: ${due} subscription(s) now due, ${ended} ended.`);
          }
        })
        .catch((error: unknown) => {
          logger.error('Marking due subscriptions failed', error);
        }),
    );
  };
  const first = setTimeout(run, 50_000);
  const every = setInterval(run, 15 * 60_000);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}

/** Drops the lockout counters whose window is long over: once at start and daily after, like the activity record. */
function startAttemptLimitPruneScheduler(): () => void {
  const prune = () => {
    trackBackground(
      pruneAttemptLimits().then(
        () => undefined,
        (error: unknown) => {
          logger.error('Attempt counter cleanup failed', error);
        },
      ),
    );
  };
  const first = setTimeout(prune, 45_000);
  const every = setInterval(prune, 24 * 60 * 60_000);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
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
  await loadPaymentPlugin();
  if (env.PAYMENT_DEMO) {
    // The fake provider wins over a configured plugin: asking for the demo is asking to see it working.
    setPaymentPlugin(createConfiguredDemoPlugin());
    logger.warn(
      `PAYMENT_DEMO is on: payments are FAKE and anyone signed in can grant themselves a paid plan at ${demoBaseUrl()}/buy. Never run a real server like this.`,
    );
  }
  await warnIfPaymentsHaveNoDefaultPlan();
  const stopSchedulers = [
    startPaymentsScheduler(),
    startMediaBlobSweepScheduler(),
    startAuditRetentionScheduler(),
    startAttemptLimitPruneScheduler(),
  ];
  const startedAt = Date.now();
  const shutdown = createShutdown({
    getServer: () => app.server,
    stopSchedulers: () => {
      for (const stop of stopSchedulers) stop();
    },
    announce: (reason) =>
      auditService.record({
        category: 'system',
        action: 'system.server_stopped',
        meta: { reason, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) },
      }),
    drainBackground,
    closeDatabase,
    exit: (code) => process.exit(code),
    log: logger,
    requestGraceMs: env.SHUTDOWN_GRACE_MS,
  });
  installShutdownHandlers(shutdown, logger);
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

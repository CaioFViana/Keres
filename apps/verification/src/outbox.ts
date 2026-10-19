import { signEventPushHeaders } from './protocol/signing';
import type { Services } from './services';
import { expireOverdue } from './decisions';

/**
 * Delivers the queued events to Keres. Each push is signed with the events key (never a Keres key), carries at most
 * one batch of events, and is retried with exponential back-off until Keres answers 2xx; then the rows are marked
 * delivered and never sent again. Keres applies each `eventId` once, so a push that arrives twice is harmless.
 *
 * The same timer runs the expiry sweep: a sending nobody decided is destroyed on time even when Keres is down.
 */

/** Keres takes at most this many events per push (`MAX_VERIFICATION_EVENTS_PER_REQUEST` in `@keres/shared`). */
export const OUTBOX_BATCH = 100;
/** How long a push to Keres may take before it counts as a failure. */
export const OUTBOUND_TIMEOUT_MS = 15_000;
const BASE_RETRY_MS = 10_000;
const MAX_RETRY_MS = 60 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 15_000;

/** The wait before the next attempt, after `attempts` failures (1 for the first): 10 s, 20 s, ... capped at an hour. */
export function retryDelayMs(attempts: number): number {
  const exponent = Math.min(Math.max(attempts - 1, 0), 20);
  return Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** exponent);
}

/**
 * One push of the due events. Returns how many were delivered. A failure is logged by its status only: the payloads
 * are personal-free by design, but they are still not written to a log.
 */
export async function deliverDueEvents(
  services: Services,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const now = services.clock();
  const rows = services.stores.outbox.due(now, OUTBOX_BATCH);
  if (rows.length === 0) return 0;

  const body = JSON.stringify({
    events: rows.map((row) => JSON.parse(row.payloadJson) as unknown),
  });
  const target = new URL(services.config.keresEventsUrl);
  const headers = signEventPushHeaders(
    services.config.eventsSecret,
    { method: 'POST', path: `${target.pathname}${target.search}`, body },
    now,
  );

  let status = 0;
  try {
    const response = await fetchImpl(services.config.keresEventsUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
    });
    status = response.status;
    await response.arrayBuffer().catch(() => undefined);
  } catch {
    status = 0;
  }

  if (status >= 200 && status < 300) {
    services.stores.outbox.markDelivered(
      rows.map((row) => row.id),
      services.clock(),
    );
    return rows.length;
  }
  services.stores.outbox.markFailed(rows, now, retryDelayMs);
  console.warn(
    `Keres did not take ${rows.length} event(s) (${status === 0 ? 'no answer' : `status ${status}`}); retrying later.`,
  );
  return 0;
}

export interface OutboxLoop {
  /** One round now: expiry, then one delivery push. Resolves when it is done. */
  tick(): Promise<void>;
  /** Stops the timer and waits for a round in progress to finish. */
  stop(): Promise<void>;
}

/** Starts the timer. A round never overlaps the one before it. */
export function startOutbox(
  services: Services,
  options: { intervalMs?: number; fetchImpl?: typeof fetch } = {},
): OutboxLoop {
  let inFlight: Promise<void> | undefined;

  const tick = (): Promise<void> => {
    if (!inFlight) {
      inFlight = (async () => {
        try {
          const ended = expireOverdue(services);
          if (ended > 0) console.log(`Ended ${ended} overdue verification(s).`);
          await deliverDueEvents(services, options.fetchImpl);
        } catch (error) {
          console.error(`Outbox round failed: ${error instanceof Error ? error.name : 'unknown'}`);
        } finally {
          inFlight = undefined;
        }
      })();
    }
    return inFlight;
  };

  const timer = setInterval(() => {
    void tick();
  }, options.intervalMs ?? DEFAULT_INTERVAL_MS);
  void tick();

  return {
    tick,
    async stop(): Promise<void> {
      clearInterval(timer);
      await inFlight;
    },
  };
}

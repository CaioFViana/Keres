import type { PaymentsConfig } from './config';
import { signEventPushHeaders } from './protocol/signing';
import type { PaymentEventWire } from './wire';

/** The path Keres verifies the signature against - the contract's, not the proxied address. */
const EVENTS_PATH = '/api/payments/events';

/**
 * Reports provider facts to the Keres server. Signed with the events key (never the connector
 * key), so a message of one direction cannot pass as the other. Keres applies each `eventId`
 * once, so pushing twice is safe.
 */
export async function pushEventsToKeres(
  config: PaymentsConfig,
  events: PaymentEventWire[],
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const body = JSON.stringify({ events });
  const headers = signEventPushHeaders(config.eventsSecret, {
    method: 'POST',
    path: EVENTS_PATH,
    body,
  });
  const response = await fetchImpl(`${config.keresBaseUrl}${EVENTS_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
  if (!response.ok) {
    throw new Error(`Keres refused the events push (${response.status}).`);
  }
}

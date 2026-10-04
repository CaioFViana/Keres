import { env } from '../../../config/env';

export interface ConnectorConfig {
  url: string;
  /** What Keres signs with first, then what it also accepts from the connector's answers. */
  secrets: string[];
  timeoutMs: number;
  /** The Bearer [REDACTED] the connector asks for at `POST /v1/play/verify`; absent when store purchases are off. */
  playSecret?: string;
}

const present = (...values: (string | undefined)[]): string[] =>
  values.filter((value): value is string => !!value);

/** Where the connector is and the keys to speak to it with; null when the server has none configured. */
export function connectorConfig(): ConnectorConfig | null {
  if (!env.PAYMENT_CONNECTOR_URL || !env.PAYMENT_CONNECTOR_SECRET) return null;
  return {
    url: env.PAYMENT_CONNECTOR_URL,
    secrets: present(env.PAYMENT_CONNECTOR_SECRET, env.PAYMENT_CONNECTOR_SECRET_PREVIOUS),
    timeoutMs: env.PAYMENT_CONNECTOR_TIMEOUT_MS,
    ...(env.PAYMENT_PLAY_ENDPOINT_SECRET ? { playSecret: env.PAYMENT_PLAY_ENDPOINT_SECRET } : {}),
  };
}

/** The keys the connector's events may be signed with: the current one, and the previous while one is being replaced. */
export function eventsSecrets(): string[] {
  return present(env.PAYMENT_EVENTS_SECRET, env.PAYMENT_EVENTS_SECRET_PREVIOUS);
}

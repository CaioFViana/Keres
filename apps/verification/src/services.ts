import type { VerificationConfig } from './config';
import type { Stores } from './store/stores';

/**
 * What the decisions, the routes and the outbox act on: the configuration, the stores and the clock. The clock is a
 * function so the tests can fix "now" (the age rule and the expiry depend on it) without touching the real one.
 */
export interface Services {
  config: VerificationConfig;
  stores: Stores;
  /** Milliseconds since the epoch. */
  clock: () => number;
}

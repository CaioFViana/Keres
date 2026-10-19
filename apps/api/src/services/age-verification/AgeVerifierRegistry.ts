import type { AgeVerifier } from '@keres/shared/age-verification/AgeVerificationConnector';

/**
 * The age-verification service this server uses, if there is one: set when the server has connected to it (see
 * `connector/startVerifier.ts`), and by the tests.
 *
 * In `required` mode a registration needs it: with none connected, new registrations are refused ("unavailable on this
 * server"), so a service that is down never means an account without a check. In `disabled` mode there is none, and
 * nothing about verification is offered.
 */
let current: AgeVerifier | null = null;

export function getAgeVerifier(): AgeVerifier | null {
  return current;
}

export function setAgeVerifier(verifier: AgeVerifier | null): void {
  current = verifier;
}

export function resetAgeVerifier(): void {
  current = null;
}

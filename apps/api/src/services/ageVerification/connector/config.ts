import { env } from '@/config/env';

export interface VerifierConfig {
  url: string;
  /** What Keres signs with first, then what it also accepts from the service's answers. */
  secrets: string[];
  timeoutMs: number;
}

const present = (...values: (string | undefined)[]): string[] =>
  values.filter((value): value is string => !!value);

/**
 * Where the age-verification service is and the keys to speak to it with; null when the server has none configured.
 * In `required` mode the environment makes sure all of it is there (boot refuses to start otherwise).
 */
export function verifierConfig(): VerifierConfig | null {
  if (!env.AGE_VERIFICATION_URL || !env.AGE_VERIFICATION_SECRET) return null;
  return {
    url: env.AGE_VERIFICATION_URL,
    secrets: present(env.AGE_VERIFICATION_SECRET, env.AGE_VERIFICATION_SECRET_PREVIOUS),
    timeoutMs: env.AGE_VERIFICATION_TIMEOUT_MS,
  };
}

/** The keys the service's events may be signed with: the current one, and the previous while one is being replaced. */
export function verifierEventsSecrets(): string[] {
  return present(env.AGE_VERIFICATION_EVENTS_SECRET, env.AGE_VERIFICATION_EVENTS_SECRET_PREVIOUS);
}

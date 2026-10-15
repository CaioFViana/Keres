import { logger } from '@/utils/logger';
import { resetAgeVerifier, setAgeVerifier } from '@/services/ageVerification/AgeVerifierRegistry';
import { type VerifierConfig, verifierConfig } from './config';
import { HttpVerifier } from './HttpVerifier';

const FIRST_RETRY_MS = 2_000;
const LONGEST_RETRY_MS = 60_000;

export interface StartVerifierOptions {
  /** Where the service is; the environment's when absent. */
  config?: VerifierConfig | null;
  /** Called once the server is connected: the place for what needs the service there. */
  onConnected?: (verifier: HttpVerifier) => void;
  fetchImpl?: typeof fetch;
}

/**
 * Connects to the age-verification service in the background, and keeps trying until it answers: a service that starts
 * after the server (or is restarted for an update) must not leave the server refusing every registration until somebody
 * restarts it. Until then new registrations answer "unavailable on this server" (the account is never created unchecked).
 *
 * Returns what stops the trying, for the server's shutdown. With no service configured it does nothing.
 */
export function startAgeVerifier(options: StartVerifierOptions = {}): () => void {
  const config = options.config === undefined ? verifierConfig() : options.config;
  if (!config) return () => undefined;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let delay = FIRST_RETRY_MS;

  const attempt = async () => {
    try {
      const verifier = await HttpVerifier.connect({
        baseUrl: config.url,
        secrets: config.secrets,
        timeoutMs: config.timeoutMs,
        fetchImpl: options.fetchImpl,
      });
      if (stopped) return;
      setAgeVerifier(verifier);
      logger.info(
        `Age-verification service "${verifier.id}" connected (${verifier.capabilities.join(', ') || 'no optional parts'}).`,
      );
      options.onConnected?.(verifier);
    } catch (error) {
      if (stopped) return;
      logger.warn(
        `The age-verification service is not available yet (${error instanceof Error ? error.message : String(error)}); trying again in ${Math.round(delay / 1000)} s. New registrations are refused until it answers.`,
      );
      timer = setTimeout(() => void attempt(), delay);
      delay = Math.min(delay * 2, LONGEST_RETRY_MS);
    }
  };
  void attempt();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    resetAgeVerifier();
  };
}

import { logger } from '../../../utils/logger';
import { setPaymentConnector } from '../PaymentConnectorRegistry';
import { type ConnectorConfig, connectorConfig } from './config';
import { HttpConnector } from './HttpConnector';

const FIRST_RETRY_MS = 2_000;
const LONGEST_RETRY_MS = 60_000;

export interface StartConnectorOptions {
  /** Where the connector is; the environment's when absent. */
  config?: ConnectorConfig | null;
  /** Called once the server is connected: the place for what needs the connector there. */
  onConnected?: (connector: HttpConnector) => void;
  fetchImpl?: typeof fetch;
}

/**
 * Connects to the payment connector in the background, and keeps trying until it answers: a connector that starts
 * after the server (or is restarted for an update) must not leave the server without payments until somebody
 * restarts it. Until then the server answers "payments are not enabled", as it does with no connector at all.
 *
 * Returns what stops the trying, for the server's shutdown. With no connector configured it does nothing.
 */
export function startPaymentConnector(options: StartConnectorOptions = {}): () => void {
  const config = options.config === undefined ? connectorConfig() : options.config;
  if (!config) return () => undefined;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let delay = FIRST_RETRY_MS;

  const attempt = async () => {
    try {
      const connector = await HttpConnector.connect({
        baseUrl: config.url,
        secrets: config.secrets,
        timeoutMs: config.timeoutMs,
        fetchImpl: options.fetchImpl,
      });
      if (stopped) return;
      setPaymentConnector(connector);
      logger.info(
        `Payment connector "${connector.id}" connected (${connector.capabilities.join(', ') || 'no optional parts'}).`,
      );
      options.onConnected?.(connector);
    } catch (error) {
      if (stopped) return;
      logger.warn(
        `The payment connector is not available yet (${error instanceof Error ? error.message : String(error)}); trying again in ${Math.round(delay / 1000)} s. Payments are off until it answers.`,
      );
      timer = setTimeout(() => void attempt(), delay);
      delay = Math.min(delay * 2, LONGEST_RETRY_MS);
    }
  };
  void attempt();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

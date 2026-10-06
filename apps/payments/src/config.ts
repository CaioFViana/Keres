/**
 * Environment of the payments microservice. The same discipline as the Keres server: secrets
 * are at least 32 characters, the two directions use different keys, and anything leaving
 * loopback goes over https unless the operator explicitly allows otherwise.
 */

const MIN_SECRET_LENGTH = 32;

function isLoopback(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch {
    return false;
  }
}

export interface PaymentsConfig {
  port: number;
  connectorId: string;
  connectorDisplayName: string;
  /** What Keres signs its requests with; we verify with these and sign our answers with the first. */
  keresSecrets: string[];
  /** Where the Keres server is, to push provider events to. */
  keresBaseUrl: string;
  /** What we sign our event pushes with (never the same key as keresSecrets). */
  eventsSecret: string;
  publicBaseUrl: string;
  paypal: { clientId: string; secret: string; sandbox: boolean; webhookId: string } | null;
  stripe: { secretKey: string; webhookSecret: string } | null;
  play: {
    endpointSecret: string;
    mock: boolean;
    /** Guards the Pub/Sub push of Google's real-time notifications; absent: renewals are not heard. */
    notificationSecret: string | null;
  } | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): PaymentsConfig {
  const get = (name: string): string | undefined => env[name];
  const req = (name: string): string => {
    const value = get(name);
    if (!value) throw new Error(`Missing required environment variable ${name}.`);
    return value;
  };
  const sec = (name: string): string => {
    const value = req(name);
    if (value.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `Environment variable ${name} must be at least ${MIN_SECRET_LENGTH} characters.`,
      );
    }
    return value;
  };
  const pub = (name: string): string => {
    const value = req(name);
    const protocol = (() => {
      try {
        return new URL(value).protocol;
      } catch {
        throw new Error(`Environment variable ${name} is not a URL.`);
      }
    })();
    if (protocol !== 'https:' && !isLoopback(value) && get('ALLOW_INSECURE_HTTP') !== 'true') {
      throw new Error(
        `${name} must be https (loopback is allowed; otherwise set ALLOW_INSECURE_HTTP=true).`,
      );
    }
    return value.replace(/\/$/, '');
  };

  const keresSecrets = [sec('KERES_CONNECTOR_SECRET')];
  if (get('KERES_CONNECTOR_SECRET_PREVIOUS')) {
    keresSecrets.push(sec('KERES_CONNECTOR_SECRET_PREVIOUS'));
  }
  const eventsSecret = sec('KERES_EVENTS_SECRET');
  if (keresSecrets.includes(eventsSecret)) {
    throw new Error('KERES_EVENTS_SECRET must differ from KERES_CONNECTOR_SECRET.');
  }

  const paypalClientId = get('PAYPAL_CLIENT_ID') ?? '';
  const paypalSecret = get('PAYPAL_SECRET') ?? '';
  const stripeSecretKey = get('STRIPE_SECRET_KEY') ?? '';
  const stripeWebhookSecret = get('STRIPE_WEBHOOK_SECRET') ?? '';
  const playEndpointSecret = get('PLAY_ENDPOINT_SECRET') ? sec('PLAY_ENDPOINT_SECRET') : '';

  return {
    port: Number(get('PORT') ?? 3101),
    connectorId: get('CONNECTOR_ID') ?? 'keres-payments',
    connectorDisplayName: get('CONNECTOR_DISPLAY_NAME') ?? 'Keres Payments',
    keresSecrets,
    keresBaseUrl: pub('KERES_BASE_URL'),
    eventsSecret,
    publicBaseUrl: pub('PUBLIC_BASE_URL'),
    paypal:
      paypalClientId && paypalSecret
        ? {
            clientId: paypalClientId,
            secret: paypalSecret,
            sandbox: (get('PAYPAL_SANDBOX') ?? 'true') !== 'false',
            webhookId: get('PAYPAL_WEBHOOK_ID') ?? '',
          }
        : null,
    stripe:
      stripeSecretKey && stripeWebhookSecret
        ? { secretKey: stripeSecretKey, webhookSecret: stripeWebhookSecret }
        : null,
    play: playEndpointSecret
      ? {
          endpointSecret: playEndpointSecret,
          mock: get('PLAY_MOCK') === 'true',
          notificationSecret: get('PLAY_NOTIFICATION_SECRET')
            ? sec('PLAY_NOTIFICATION_SECRET')
            : null,
        }
      : null,
  };
}

/**
 * Fail-fast for live Play Billing: verifying for real needs the service-account key, and starting
 * without it would refuse every purchase at runtime. Mock mode needs no key.
 */
export function assertPlayReady(
  config: PaymentsConfig,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (config.play && !config.play.mock && !env['PLAY_SERVICE_ACCOUNT_JSON']) {
    throw new Error(
      'PLAY_SERVICE_ACCOUNT_JSON is required for live Play verification (or set PLAY_MOCK=true for homologation).',
    );
  }
}

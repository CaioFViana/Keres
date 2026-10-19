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
    /**
     * The one app this service sells for. Set, it is the only package a purchase may name and the one
     * cancellations are sent for (a cancel names only the token, and Google needs the package). Absent:
     * any package the app says, and no cancellation from here.
     */
    packageName: string | null;
    /**
     * Whether a purchase made by a license tester (the closed-testing track) counts as paid. Off by default:
     * for homologation it has to be on, and then those purchases grant plans for nothing.
     */
    acceptTestPurchases: boolean;
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
          packageName: get('PLAY_PACKAGE_NAME') || null,
          acceptTestPurchases: get('PLAY_ACCEPT_TEST_PURCHASES') === 'true',
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

export interface ConfigProblems {
  /** Starting would sell something that cannot work: the service refuses to boot. */
  fatal: string[];
  /** Starting works, but part of what the operator meant to switch on is silently off or half-working. */
  warnings: string[];
}

/**
 * What is wrong with a configuration that still loads. The variables that matter come in pairs (a client id and
 * its secret, a provider and the webhook that tells us about its renewals), and half a pair does not fail - it
 * just turns something off without a word: a PayPal without its webhook id takes first payments through the
 * return page and never hears a renewal, so every subscriber would lapse a month later. Said at the start, where
 * the operator is looking, instead of discovered from the first lapsed customer.
 */
export function configProblems(
  config: PaymentsConfig,
  env: NodeJS.ProcessEnv = process.env,
): ConfigProblems {
  const fatal: string[] = [];
  const warnings: string[] = [];
  const set = (name: string) => Boolean(env[name]);

  if (set('PAYPAL_CLIENT_ID') !== set('PAYPAL_SECRET')) {
    warnings.push(
      'PayPal is OFF: PAYPAL_CLIENT_ID and PAYPAL_SECRET are both needed, and only one is set.',
    );
  }
  if (set('STRIPE_SECRET_KEY') !== set('STRIPE_WEBHOOK_SECRET')) {
    warnings.push(
      'Google Pay (Stripe) is OFF: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are both needed, and only one is set.',
    );
  }
  if (config.paypal && !config.paypal.webhookId) {
    const message =
      'PAYPAL_WEBHOOK_ID is empty: every PayPal webhook would be refused, so renewals and cancellations never reach Keres' +
      ' (first payments still arrive through the return page).';
    if (config.paypal.sandbox)
      warnings.push(`${message} Fine for a quick sandbox try, not for anything real.`);
    else
      fatal.push(`${message} Set it (the id of the webhook PayPal sends to /v1/paypal/webhook).`);
  }
  if (config.play && !config.play.mock && !config.play.notificationSecret) {
    warnings.push(
      'PLAY_NOTIFICATION_SECRET is empty: renewals and cancellations made in the Play Store are not heard ' +
        '(a subscription would lapse on Keres a month after its first purchase unless the app is opened).',
    );
  }
  if (config.play && !config.play.mock && !config.play.packageName) {
    warnings.push(
      'PLAY_PACKAGE_NAME is empty: any package name the app sends is accepted, and a store subscription cannot be ' +
        'cancelled from here (the person has to do it in the Play Store).',
    );
  }
  if (config.play?.acceptTestPurchases && !config.play.mock) {
    warnings.push(
      'PLAY_ACCEPT_TEST_PURCHASES is on: a purchase by a license tester counts as paid and grants a plan for nothing. ' +
        'Only for homologation.',
    );
  }
  if (
    config.publicBaseUrl.startsWith('http://') &&
    !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(config.publicBaseUrl)
  ) {
    warnings.push(
      'PUBLIC_BASE_URL is plain http outside this machine: providers will refuse to send webhooks there.',
    );
  }
  return { fatal, warnings };
}

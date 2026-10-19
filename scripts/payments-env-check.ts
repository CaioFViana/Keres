/**
 * Checks that apps/api/.env and apps/payments/.env describe one working pair. Each file goes through
 * the validator its own service uses at boot (so a value the service would refuse is refused here
 * too), then the two are compared: matching keys, addresses that point at each other, and the
 * development-only switches only where they are safe. Reads the files, starts nothing.
 *
 *   bun run payments:env-check
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';

const root = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `  (${detail})`}`);
}
function note(label: string): void {
  console.log(`note ${label}`);
}

const paymentsFile = join(root, 'apps/payments/.env');
const apiFile = join(root, 'apps/api/.env');
const payments = dotenv.parse(readFileSync(paymentsFile, 'utf8'));
const api = dotenv.parse(readFileSync(apiFile, 'utf8'));

// --- each side through its own validator ---
const { assertPlayReady, loadConfig } = await import('../apps/payments/src/config');
let paymentsConfig: ReturnType<typeof loadConfig> | null = null;
try {
  paymentsConfig = loadConfig(payments as NodeJS.ProcessEnv);
  assertPlayReady(paymentsConfig, payments as NodeJS.ProcessEnv);
  check("payments .env passes the service's own validation", true);
} catch (error) {
  check("payments .env passes the service's own validation", false, (error as Error).message);
}

// The API reads its own .env when this module loads (the same call it makes at boot).
let apiEnv: typeof import('../apps/api/src/config/env')['env'] | null = null;
try {
  apiEnv = (await import('../apps/api/src/config/env')).env;
  check("api .env passes the server's own validation", true);
} catch (error) {
  check("api .env passes the server's own validation", false, (error as Error).message);
}

if (!paymentsConfig || !apiEnv) {
  console.log(
    '\nFix the above first: the pair cannot be compared until each file is valid on its own.',
  );
  process.exit(1);
}

// --- the pair ---
check(
  'the server points at a connector',
  Boolean(apiEnv.PAYMENT_CONNECTOR_URL),
  'PAYMENT_CONNECTOR_URL is empty',
);
check(
  'Keres -> service key is the same on both sides',
  apiEnv.PAYMENT_CONNECTOR_SECRET === paymentsConfig.keresSecrets[0],
  'PAYMENT_CONNECTOR_SECRET != KERES_CONNECTOR_SECRET',
);
check(
  'service -> Keres key is the same on both sides',
  apiEnv.PAYMENT_EVENTS_SECRET === paymentsConfig.eventsSecret,
  'PAYMENT_EVENTS_SECRET != KERES_EVENTS_SECRET',
);
check(
  'the two directions use different keys',
  apiEnv.PAYMENT_CONNECTOR_SECRET !== apiEnv.PAYMENT_EVENTS_SECRET,
);

const connectorUrl = apiEnv.PAYMENT_CONNECTOR_URL ? new URL(apiEnv.PAYMENT_CONNECTOR_URL) : null;
const publicUrl = new URL(paymentsConfig.publicBaseUrl);
const keresUrl = new URL(paymentsConfig.keresBaseUrl);
const port = (url: URL) => url.port || (url.protocol === 'https:' ? '443' : '80');
const apiPort = process.env.PORT ?? api.PORT ?? '3000';

if (connectorUrl) {
  check(
    "the server's connector address is the service's own public address",
    connectorUrl.origin === publicUrl.origin,
    `${connectorUrl.origin} vs ${publicUrl.origin}`,
  );
}
check(
  'the service listens where its public address says (loopback/local only)',
  String(paymentsConfig.port) === port(publicUrl) || publicUrl.hostname !== '127.0.0.1',
  `PORT=${paymentsConfig.port}, PUBLIC_BASE_URL port ${port(publicUrl)}`,
);
check(
  "the service's address for Keres is the server's port",
  port(keresUrl) === apiPort,
  `KERES_BASE_URL port ${port(keresUrl)}, server PORT ${apiPort}`,
);

const playOnService = Boolean(paymentsConfig.play);
const playOnServer = Boolean(apiEnv.PAYMENT_PLAY_ENDPOINT_SECRET);
check(
  'store purchases are on at both ends or at neither',
  playOnService === playOnServer,
  `service ${playOnService}, server ${playOnServer}`,
);
if (playOnService && playOnServer) {
  check(
    'the store endpoint key is the same on both sides',
    apiEnv.PAYMENT_PLAY_ENDPOINT_SECRET === paymentsConfig.play?.endpointSecret,
    'PAYMENT_PLAY_ENDPOINT_SECRET != PLAY_ENDPOINT_SECRET',
  );
}

const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(publicUrl.hostname);
const methods = [
  paymentsConfig.paypal ? 'paypal' : null,
  paymentsConfig.stripe ? 'googlepay' : null,
  loopback && payments.MOCK_METHODS === 'true' ? 'mock' : null,
].filter(Boolean);
check(
  'at least one way to pay is configured',
  methods.length > 0 || playOnService,
  'no provider keys and no mock',
);
if (payments.MOCK_METHODS === 'true' && !loopback) {
  note(
    'MOCK_METHODS=true is ignored: the public address is not this machine (by design, so a fake bank never faces the internet).',
  );
}
if (methods.includes('mock')) {
  check(
    'the fake bank page (plain http) is allowed to open',
    apiEnv.PAYMENT_ALLOW_INSECURE_REDIRECTS === true,
    'set PAYMENT_ALLOW_INSECURE_REDIRECTS="true" in apps/api/.env',
  );
}
if (paymentsConfig.play?.mock) {
  note('PLAY_MOCK=true: any purchase token counts as paid. Fine here, never in production.');
}
if (paymentsConfig.play && !paymentsConfig.play.notificationSecret) {
  note('PLAY_NOTIFICATION_SECRET is empty: renewals bought in the Play Store will not be heard.');
}
note(
  `providers listed by the service: ${[...methods, ...(playOnService ? ['playbilling (Android)'] : [])].join(', ') || 'none'}`,
);

console.log(
  failures === 0 ? '\nThe two .env files fit together.' : `\n${failures} problem(s) above.`,
);
process.exit(failures === 0 ? 0 : 1);

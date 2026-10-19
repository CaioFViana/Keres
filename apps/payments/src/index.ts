import { assertPlayReady, configProblems, loadConfig } from './config';
import { createApp, createState } from './routes';

/** Production entrypoint: reads the environment, then opens the HTTP port. */
let config;
try {
  config = loadConfig();
  assertPlayReady(config);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

// Half a pair of variables turns a provider off or half on without failing: say so now, and refuse to sell what
// cannot work (a live PayPal that would never hear a renewal).
const problems = configProblems(config);
for (const warning of problems.warnings) console.warn(`WARNING: ${warning}`);
if (problems.fatal.length > 0) {
  for (const message of problems.fatal) console.error(`ERROR: ${message}`);
  process.exit(1);
}

const state = createState(config);
const methods = state.providers.flatMap((provider) => provider.methodIds);
if (methods.length === 0) {
  console.warn(
    'No payment provider is configured: no method will be listed. ' +
      'Set PAYPAL_CLIENT_ID/PAYPAL_SECRET and/or STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET.',
  );
} else {
  console.log(`Payment methods: ${methods.join(', ')}`);
}
if (config.play) {
  console.log(
    `Play Billing verification: ${config.play.mock ? 'MOCK (no real charge is checked)' : 'live'}.`,
  );
}
if (methods.includes('mock')) {
  console.warn(
    'MOCK provider enabled: anyone opening the mock page can grant themselves a plan. ' +
      'Development only - never with a public PUBLIC_BASE_URL.',
  );
}

const app = createApp(state);

// Loopback unless HOST says otherwise: behind the reverse proxy nothing else should reach this
// port, and the development mock page grants plans to whoever opens it. The container image sets
// HOST=0.0.0.0 (its port is published to loopback by the compose file).
const hostname = process.env.HOST ?? '127.0.0.1';

export default {
  hostname,
  port: config.port,
  fetch: app.fetch,
  // Webhooks, pushes and verifications are a few kilobytes; nothing here takes an upload.
  maxRequestBodySize: 256 * 1024,
};

console.log(`Keres payments listening on ${hostname}:${config.port}`);

import { assertPlayReady, loadConfig } from './config';
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

export default {
  port: config.port,
  fetch: app.fetch,
};

console.log(`Keres payments listening on :${config.port}`);

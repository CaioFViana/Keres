import { ConfigError, configWarnings, loadConfig } from './config';
import { startOutbox } from './outbox';
import { createApp, createState } from './routes';
import { FORM_OVERHEAD_BYTES, totalUploadBytes } from './pages/upload/uploadRules';

/**
 * Production entrypoint: reads the environment, opens the stores, starts the outbox timer, then serves the protocol.
 * A configuration with any problem stops the boot before a socket is opened, and says every problem it found.
 */
let config;
try {
  config = loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    for (const problem of error.problems) console.error(`ERROR: ${problem}`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exit(1);
}

for (const warning of configWarnings(config)) console.warn(`WARNING: ${warning}`);

const state = createState(config);
const loop = startOutbox(state);
const pending = state.stores.outbox.undeliveredCount();
if (pending > 0) console.log(`${pending} event(s) waiting to be delivered to Keres.`);

const app = createApp(state);

// Loopback unless HOST says otherwise: behind the reverse proxy nothing else should reach this port. The container
// image sets HOST=0.0.0.0 (its port is published to loopback by the compose file).
export default {
  hostname: config.host,
  port: config.port,
  fetch: app.fetch,
  // The protocol carries a few kilobytes, but the upload page takes a document (front and back) and a live photo: three
  // images at most, plus the form's overhead. The upload route enforces the exact limits; this is the outer wall.
  maxRequestBodySize: totalUploadBytes(config.maxUploadBytes) + FORM_OVERHEAD_BYTES,
};

console.log(
  `Keres verification service "${config.serviceId}" listening on ${config.host}:${config.port}.`,
);

// A stop signal waits for a delivery round in progress, then closes the databases: no event is half written.
const shutdown = (): void => {
  void loop.stop().then(() => {
    state.stores.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

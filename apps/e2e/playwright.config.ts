import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE = process.env.E2E_BASE ?? '/Keres/client';

/**
 * The web client's build (`bun run --cwd apps/client build:pages`, with `KERES_WEB_BASE_URL` equal to `E2E_BASE`)
 * served like GitHub Pages serves it and opened in a real browser. `E2E_CHANNEL=chrome` uses the installed Chrome
 * instead of Playwright's own Chromium, which a developer machine does not need to download.
 */
export default defineConfig({
  testDir: './tests',
  // A cold start loads the client's bundle, a WASM SQLite and its worker, and runs the migrations.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  forbidOnly: !!process.env.CI,
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}${BASE}/`,
    channel: process.env.E2E_CHANNEL || undefined,
    // The copy is asserted in English.
    locale: 'en-US',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'bun static-server.ts',
    url: `http://127.0.0.1:${PORT}${BASE}/`,
    reuseExistingServer: !process.env.CI,
    env: { E2E_PORT: String(PORT), E2E_BASE: BASE },
  },
});

import { defineConfig } from '@playwright/test';

const PAGES_PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE = process.env.E2E_BASE ?? '/Keres/client';
const API_PORT = Number(process.env.E2E_API_PORT ?? 3399);

/**
 * Two builds of the web client, each opened in a real browser:
 *
 * - `pages`: `bun run --cwd apps/client build:pages` (with `KERES_WEB_BASE_URL` equal to `E2E_BASE`), served the way
 *   GitHub Pages serves it - the serverless client, alone on the device.
 * - `online`: `bun run --cwd apps/client build:hosted`, served by the API itself at `/client`, on a throwaway SQLite
 *   database - the client a person uses with a server (see `api-server.ts`).
 *
 * `E2E_CHANNEL=chrome` uses the installed Chrome instead of Playwright's own Chromium, which a developer machine
 * does not need to download. Run one project with `--project pages` or `--project online`.
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
    channel: process.env.E2E_CHANNEL || undefined,
    // The copy is asserted in English.
    locale: 'en-US',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'pages',
      testMatch: ['first-run.spec.ts', 'library-journey.spec.ts'],
      use: { baseURL: `http://127.0.0.1:${PAGES_PORT}${BASE}/` },
    },
    {
      name: 'online',
      testMatch: ['online-*.spec.ts'],
      use: { baseURL: `http://127.0.0.1:${API_PORT}/client/` },
    },
  ],
  webServer: [
    {
      command: 'bun static-server.ts',
      url: `http://127.0.0.1:${PAGES_PORT}${BASE}/`,
      reuseExistingServer: !process.env.CI,
      env: { E2E_PORT: String(PAGES_PORT), E2E_BASE: BASE },
    },
    {
      command: 'bun api-server.ts',
      url: `http://127.0.0.1:${API_PORT}/api/public/config`,
      // A fresh database on every run: reusing a server would carry the accounts of the last one.
      reuseExistingServer: false,
      timeout: 60_000,
      env: { E2E_API_PORT: String(API_PORT) },
    },
  ],
});

import { expect, type Page } from '@playwright/test';

/** What a person does to get into the web client for the first time, and the moves every journey repeats. */

/** The page isolates itself with a service worker and reloads once; the app is usable only after that. */
export async function waitForIsolation(page: Page) {
  await page.waitForFunction(() => window.crossOriginIsolated, null, { timeout: 60_000 });
}

/** Every error the page raises or logs; a journey ends by asserting the list is empty. */
export function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
  });
  return problems;
}

/** A first visit shows a short tour over a screen the first time it opens; it covers the controls until dismissed. */
export async function dismissTour(page: Page) {
  await page
    .getByTestId('guide-skip')
    .click({ timeout: 4_000 })
    .catch(() => {});
}

/** Reading the terms and the privacy notice is required before the name can be sent: scroll, wait, accept. */
async function acceptDocument(page: Page, which: 'terms' | 'privacy') {
  await page.getByTestId(`welcome-${which}-button`).click();
  const scroll = page.getByTestId(`welcome-${which}-modal-scroll`);
  await scroll.waitFor();
  const accept = page.getByTestId(`welcome-${which}-modal-accept`);
  // The accept button stays disabled until the text was scrolled to its end and a reading time has passed.
  await expect(async () => {
    await scroll.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(accept).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 60_000 });
  await accept.click();
  await scroll.waitFor({ state: 'detached' });
}

/** Opens the client, walks the welcome and lands on the first screen, ready for a first story. */
export async function enterFirstTime(page: Page, name = 'Ana') {
  await page.goto('./');
  await waitForIsolation(page);

  await page.getByTestId('welcome-pager').waitFor({ timeout: 60_000 });
  await page.getByTestId('welcome-next').click();
  await page.getByTestId('welcome-next').click();
  await page.getByPlaceholder('Enter your username').fill(name);
  await acceptDocument(page, 'terms');
  await acceptDocument(page, 'privacy');
  await page.getByRole('button', { name: 'Proceed' }).click();

  await page.getByTestId('first-story-banner').waitFor({ timeout: 60_000 });
  await dismissTour(page);
}

/** Installs the first bundled example (Alice in Wonderland, a branching story) and opens it. */
export async function installAndOpenAlice(page: Page) {
  await page.getByTestId('first-story-example-action').click();
  await dismissTour(page);
  await page.getByLabel('Install').first().click();
  await page.getByText('Example story installed!').waitFor();
  await page.getByTestId('drawer-item-StorySelectionMain').click();
  await page.getByText('Alice in Wonderland').first().click();
  await page.getByTestId('drawer-story-header').waitFor();
  await dismissTour(page);
}

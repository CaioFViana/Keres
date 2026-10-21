import { expect, type Page, test } from '@playwright/test';

/**
 * The first visit to the web client, as a person has it: the page isolates itself and reloads once, the
 * welcome walks through, a first story is created, and a reload brings back the same device with the story in
 * it. What no unit test can say: the bundle boots under the Pages path, the service worker gives the page
 * `SharedArrayBuffer`, the WASM SQLite opens, its migrations run and what it stores survives a reload.
 */

const STORY_TITLE = 'Smoke Story';

/** The page isolates itself with a service worker and reloads once; the app is usable only after that. */
async function waitForIsolation(page: Page) {
  await page.waitForFunction(() => window.crossOriginIsolated, null, { timeout: 60_000 });
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

test('first visit: welcome, first story, and it is still there after a reload', async ({
  page,
}) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
  });

  await page.goto('./');
  await waitForIsolation(page);

  // Welcome: what Keres is, where the stories live, and the name.
  await page.getByTestId('welcome-pager').waitFor({ timeout: 60_000 });
  await page.getByTestId('welcome-next').click();
  await page.getByTestId('welcome-next').click();
  await page.getByPlaceholder('Enter your username').fill('Ana');
  await acceptDocument(page, 'terms');
  await acceptDocument(page, 'privacy');
  await page.getByRole('button', { name: 'Proceed' }).click();

  // The first screen offers three ways to start, under a tour that is dismissed first.
  await page.getByTestId('first-story-banner').waitFor({ timeout: 60_000 });
  await page.getByTestId('guide-skip').click();
  await page.getByTestId('first-story-blank-action').click();

  await page.getByPlaceholder('Enter story title').fill(STORY_TITLE);
  await page.getByRole('button', { name: 'Create Story' }).click();
  await expect(page.getByText(STORY_TITLE).first()).toBeVisible();

  // The same device, again: no welcome, and the story the database holds.
  await page.reload();
  await waitForIsolation(page);
  await expect(page.getByText(STORY_TITLE).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('welcome-pager')).toHaveCount(0);

  expect(problems).toEqual([]);
});

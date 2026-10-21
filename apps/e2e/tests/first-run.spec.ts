import { expect, test } from '@playwright/test';
import { collectProblems, dismissTour, enterFirstTime, waitForIsolation } from './support/app';

/**
 * The first visit to the web client, as a person has it: the page isolates itself and reloads once, the
 * welcome walks through, a first story is created, and a reload brings back the same device with the story in
 * it. What no unit test can say: the bundle boots under the Pages path, the service worker gives the page
 * `SharedArrayBuffer`, the WASM SQLite opens, its migrations run and what it stores survives a reload.
 */

const STORY_TITLE = 'Smoke Story';

test('first visit: welcome, first story, and it is still there after a reload', async ({
  page,
}) => {
  const problems = collectProblems(page);

  await enterFirstTime(page);

  await page.getByTestId('first-story-blank-action').click();
  await dismissTour(page);
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

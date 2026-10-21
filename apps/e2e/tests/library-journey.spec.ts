import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { collectProblems, dismissTour, enterFirstTime, installAndOpenAlice } from './support/app';

/**
 * A story from the bundled examples, taken through what the web client does with a story: its map is drawn, the
 * manuscript is exported, a copy of the story is saved and imported back. What no unit test can say: the Skia
 * canvas draws on the CanvasKit WASM, the export pipeline runs on the real bundle, and a file the browser
 * downloads is the file the importer accepts.
 */

test('an example story: map drawn, manuscript exported, backup imported back', async ({
  page,
}, testInfo) => {
  const problems = collectProblems(page);

  await enterFirstTime(page);
  await installAndOpenAlice(page);

  // The story map is a Skia canvas: a blank one would still be a canvas, so the pixels are read.
  await page.getByTestId('drawer-item-NarrativeElementsStack').click();
  await dismissTour(page);
  await page.getByLabel('Story Map').click();
  await dismissTour(page);
  await expect(page.getByText('12 scenes · 16 choices')).toBeVisible({ timeout: 60_000 });
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  await expect(async () => {
    const picture = PNG.sync.read(await canvas.screenshot());
    let inked = 0;
    for (let offset = 0; offset < picture.data.length; offset += 4) {
      const [red, green, blue, alpha] = picture.data.subarray(offset, offset + 4);
      if (alpha > 0 && (red < 235 || green < 235 || blue < 235)) inked += 1;
    }
    expect(inked).toBeGreaterThan(500);
  }).toPass({ timeout: 30_000 });

  // The manuscript, as Markdown: the prose as a document, made on the device.
  await page.getByTestId('drawer-item-StoryShare').click();
  await dismissTour(page);
  await page.getByTestId('story-share-manuscript').click();
  await page.getByTestId('export-format-md').click();
  const [manuscript] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-confirm').click(),
  ]);
  expect(manuscript.suggestedFilename()).toMatch(/^alice-in-wonderland-manuscript-.*\.md$/);
  const manuscriptText = await readFile(await manuscript.path(), 'utf8');
  expect(manuscriptText).toMatch(/^# Alice in Wonderland/);
  expect(manuscriptText.length).toBeGreaterThan(5_000);

  // A copy of everything in the story, one file.
  await page.getByTestId('drawer-item-StoryShare').click();
  const [backup] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('story-share-backup-json').click(),
  ]);
  const backupPath = testInfo.outputPath('alice-backup.json');
  await backup.saveAs(backupPath);
  expect(
    (JSON.parse(await readFile(backupPath, 'utf8')) as { story: { title: string } }).story.title,
  ).toBe('Alice in Wonderland');

  // And the file the browser saved is a file the importer takes: the story arrives as a second one.
  await page.getByTestId('drawer-item-StorySelection').click();
  await page.getByTestId('drawer-item-ImportStory').click();
  await dismissTour(page);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText('Choose file').click(),
  ]);
  await chooser.setFiles(backupPath);
  await page.getByTestId('drawer-item-StorySelectionMain').click();
  await expect(page.getByText('Stories: 2 - Branching: 2')).toBeVisible({ timeout: 60_000 });

  expect(problems).toEqual([]);
});

import { expect, type Page } from '@playwright/test';
import { dismissTour } from './app';

/** The moves of a person using the web client with a server: an account, a story sent to it, a second device. */

export const PASSWORD = 'Correct-Horse-9-Battery';

/** What the hosted client logs while nobody is signed in: its first probe of the session answers 401. */
export const EXPECTED_BEFORE_SIGN_IN = [/status of 401/];

/** Server management with no account yet opens on the invitation to the one server a browser can use. */
async function openRegisterServer(page: Page) {
  await page.getByTestId('drawer-item-ServerManagementDrawer').click();
  await dismissTour(page);
  await page.getByTestId('default-server-cta').click();
  await dismissTour(page);
}

/** Reads a server's terms or privacy policy to its end, as the app asks, and accepts it. */
async function acceptServerDocument(page: Page, which: 'terms' | 'privacy') {
  const scroll = page.getByTestId(`server-${which}-modal-scroll`);
  await scroll.waitFor();
  const accept = page.getByTestId(`server-${which}-modal-accept`);
  await expect(async () => {
    await scroll.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(accept).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 60_000 });
  await accept.click();
  await scroll.waitFor({ state: 'detached' });
}

/** Creates an account on the server that served this page (the only one a browser can use). */
export async function createAccount(page: Page, username: string) {
  await openRegisterServer(page);
  await page.getByText('Create Account', { exact: true }).click();
  await page.getByPlaceholder('Enter your username').fill(username);
  await page.getByPlaceholder('Enter your password').fill(PASSWORD);
  await page.getByPlaceholder('Re-enter your new password').fill(PASSWORD);
  await page.getByTestId('server-register-adult-switch').click();
  await page.getByRole('button', { name: 'Create Account', exact: true }).last().click();
  await acceptServerDocument(page, 'terms');
  await acceptServerDocument(page, 'privacy');
  await page.getByText('Server registered successfully!').waitFor();
  await page.getByText('OK', { exact: true }).click();
  await page.getByRole('button', { name: "I've saved them, continue" }).click();
}

/** Signs an existing account in on a device that has none; the server's stories come down with it. */
export async function signIn(page: Page, username: string) {
  await openRegisterServer(page);
  await page.getByPlaceholder('Enter your username').fill(username);
  await page.getByPlaceholder('Enter your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Register Server' }).click();
  await page.getByText('Server registered successfully!').waitFor();
}

/** Closes the alert a step ends with. */
export async function acknowledge(page: Page) {
  await page.getByText('OK', { exact: true }).click();
}

/** A blank story, created from the first screen and opened. */
export async function createAndOpenStory(page: Page, title: string) {
  await page.getByTestId('drawer-item-StorySelectionMain').click();
  await dismissTour(page);
  await page.getByTestId('first-story-blank-action').click();
  await dismissTour(page);
  await page.getByPlaceholder('Enter story title').fill(title);
  await page.getByRole('button', { name: 'Create Story' }).click();
  await page.getByText('Story created successfully!').waitFor();
  await page.getByText('OK', { exact: true }).click();
  await openStory(page, title);
}

/** Opens a story from the list of the stories on this device. */
export async function openStory(page: Page, title: string) {
  await page.getByTestId('drawer-item-StorySelectionMain').click();
  await dismissTour(page);
  await page.getByText(title).first().click();
  await page.getByTestId('drawer-story-header').waitFor();
  await dismissTour(page);
}

/** Links the open story to the server, which is what makes it sync. */
export async function sendStoryToServer(page: Page, serverAddress: string) {
  await page.getByTestId('drawer-item-StorySettings').click();
  await dismissTour(page);
  await page.getByTestId('story-settings-collaboration').click();
  await dismissTour(page);
  await page.getByText('Select Server').click();
  await page.getByText(serverAddress).last().click();
  await page.getByRole('button', { name: 'Send to Server' }).click();
  await page.getByText('Story sent to the server').waitFor();
  await page.getByText('OK', { exact: true }).click();
}

/** Adds a character to the open story. */
export async function addCharacter(page: Page, name: string) {
  await page.getByTestId('drawer-item-CharactersStack').click();
  await dismissTour(page);
  // Under the first character the list has an add button of its own; the empty list offers this one.
  const empty = page.getByTestId('empty-create-character');
  if (await empty.isVisible()) await empty.click();
  else await page.getByLabel('Add', { exact: true }).click();
  await dismissTour(page);
  await page.getByPlaceholder('Enter the name').fill(name);
  await page.getByRole('button', { name: 'Save Character' }).click();
  await page.getByText('Character created successfully!').waitFor();
  await acknowledge(page);
}

/** Shows the characters of the open story. */
export async function openCharacters(page: Page) {
  await page.getByTestId('drawer-item-CharactersStack').click();
  await dismissTour(page);
}

/** A text that is on screen now: a stacked screen keeps its own copy in the page, hidden, and `first()` can be that one. */
export function shown(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true }).first();
}

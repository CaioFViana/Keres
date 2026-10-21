import { expect, test } from '@playwright/test';
import { collectProblems, enterFirstTime } from './support/app';
import {
  acknowledge,
  addCharacter,
  createAccount,
  createAndOpenStory,
  EXPECTED_BEFORE_SIGN_IN,
  openCharacters,
  openStory,
  sendStoryToServer,
  shown,
  signIn,
} from './support/online';

/**
 * Two devices of one person and a real server: the client a person uses with a server, in two browser profiles that
 * share nothing but the account. The first creates the account and sends a story; the second signs in and gets it;
 * then each adds a character and sees the other's arrive. What no other test says: the sync engine, the API and
 * the database meet through the interface - registration, the story's link to the server, the pull on sign-in and
 * the live updates after it.
 */

const STORY_TITLE = 'Online Story';

test.setTimeout(300_000);

test('two devices of one account: the story comes down on sign-in and each one sees the other edit', async ({
  baseURL,
  browser,
  page: deviceA,
}) => {
  const username = `ana-${Date.now().toString(36)}`;
  const problemsA = collectProblems(deviceA, EXPECTED_BEFORE_SIGN_IN);

  // Device B is another profile of the same person. It reads the welcome while A does its part: that takes a minute of
  // reading time, and the two share nothing until B signs in.
  const contextB = await browser.newContext({ baseURL, locale: 'en-US' });
  const deviceB = await contextB.newPage();
  const problemsB = collectProblems(deviceB, EXPECTED_BEFORE_SIGN_IN);
  const deviceBWelcomed = enterFirstTime(deviceB, 'Ana on the other device');

  // Device A: an account, a story, and the story on the server.
  await enterFirstTime(deviceA, 'Ana');
  await createAccount(deviceA, username);
  await createAndOpenStory(deviceA, STORY_TITLE);
  await sendStoryToServer(deviceA, new URL(baseURL ?? '').origin);

  // Device B signs in to the same account; the server's story comes with the sign-in.
  await deviceBWelcomed;
  await signIn(deviceB, username);
  await expect(deviceB.getByText(`Story '${STORY_TITLE}' downloaded and imported!`)).toBeVisible({
    timeout: 60_000,
  });
  await acknowledge(deviceB);

  // A writes, B reads.
  await addCharacter(deviceA, 'Aria');
  await openStory(deviceB, STORY_TITLE);
  await openCharacters(deviceB);
  await expect(shown(deviceB, 'Aria')).toBeVisible({ timeout: 60_000 });

  // B writes, A reads.
  await addCharacter(deviceB, 'Bram');
  await openCharacters(deviceA);
  await expect(shown(deviceA, 'Bram')).toBeVisible({ timeout: 60_000 });

  // Both ended with both.
  await expect(shown(deviceA, 'Aria')).toBeVisible();
  await openCharacters(deviceB);
  await expect(shown(deviceB, 'Bram')).toBeVisible();

  await contextB.close();
  expect(problemsA).toEqual([]);
  expect(problemsB).toEqual([]);
});

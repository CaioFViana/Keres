import { describe, expect, it } from 'vitest';
import {
  splitAuthorization,
  verifyNsfwToken,
  verifyShowcaseToken,
} from '../../src/modules/public/showcaseAccess';

const jwtFor =
  (payload: { storyId?: string; nsfwOk?: boolean } | false) => async (_token: string) =>
    payload;

describe('splitAuthorization', () => {
  it('reads each half of a combined session + unlock header', () => {
    expect(splitAuthorization('Bearer abc, Showcase xyz')).toEqual({
      bearer: 'Bearer abc',
      showcase: 'Showcase xyz',
    });
  });

  it('reads single credentials and nothing at all', () => {
    expect(splitAuthorization('Bearer abc')).toEqual({ bearer: 'Bearer abc' });
    expect(splitAuthorization('Showcase xyz')).toEqual({ showcase: 'Showcase xyz' });
    expect(splitAuthorization(undefined)).toEqual({});
  });
});

describe('showcase tokens behind a combined header', () => {
  it('proves the password with the Showcase half alone', async () => {
    const jwt = { verify: jwtFor({ storyId: 'story-1' }) };
    await expect(
      verifyShowcaseToken(jwt, 'Bearer session-1, Showcase unlock-1', 'story-1'),
    ).resolves.toBe(true);
    await expect(
      verifyShowcaseToken(jwt, 'Bearer session-1, Showcase unlock-1', 'story-2'),
    ).resolves.toBe(false);
  });

  it('carries the verified-adult proof only with nsfwOk for this story', async () => {
    const jwt = { verify: jwtFor({ storyId: 'story-1', nsfwOk: true }) };
    await expect(
      verifyNsfwToken(jwt, 'Bearer session-1, Showcase unlock-1', 'story-1'),
    ).resolves.toBe(true);
    await expect(
      verifyNsfwToken(jwt, 'Bearer session-1, Showcase unlock-1', 'story-2'),
    ).resolves.toBe(false);
  });

  it('refuses the adult proof without the claim', async () => {
    const jwt = { verify: jwtFor({ storyId: 'story-1' }) };
    await expect(verifyNsfwToken(jwt, 'Showcase unlock-1', 'story-1')).resolves.toBe(false);
  });
});

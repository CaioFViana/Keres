import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  viewerIncludesNsfw: vi.fn(),
  isVisibleTo: vi.fn(),
}));

vi.mock('../../src/services/ShowcaseService', () => ({
  showcaseService: {
    viewerIncludesNsfw: mocks.viewerIncludesNsfw,
    isVisibleTo: mocks.isVisibleTo,
  },
}));

import { assertShowcaseOpen } from '../../src/modules/public/showcaseGate';

/** A signer that knows these tokens: `Showcase <token>` → what the token proves. */
const jwt = (known: Record<string, { storyId: string; nsfwOk?: boolean }>) => ({
  verify: async (token: string) => known[token] ?? false,
});

const open = (overrides: Partial<Parameters<typeof assertShowcaseOpen>[0]> = {}) =>
  assertShowcaseOpen({
    entry: { visibility: 'public' },
    storyId: 's1',
    user: null,
    showcaseJwt: jwt({}),
    credentials: [undefined],
    ...overrides,
  });

describe('assertShowcaseOpen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.viewerIncludesNsfw.mockResolvedValue(false);
    mocks.isVisibleTo.mockResolvedValue(true);
  });

  it('lets a public story through for anyone, without NSFW', async () => {
    await expect(open()).resolves.toBe(false);
    expect(mocks.isVisibleTo).toHaveBeenCalledWith('s1', false);
  });

  it('answers "not found" for a password story without its token, and opens it with one', async () => {
    const entry = { visibility: 'password' };
    await expect(open({ entry })).rejects.toMatchObject({ status: 404 });
    await expect(
      open({
        entry,
        showcaseJwt: jwt({ good: { storyId: 's2' } }),
        credentials: ['Showcase good'],
      }),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      open({
        entry,
        showcaseJwt: jwt({ good: { storyId: 's1' } }),
        credentials: ['Showcase good'],
      }),
    ).resolves.toBe(false);
  });

  it('takes the token from the `?access=` credential when the header carries none', async () => {
    await expect(
      open({
        entry: { visibility: 'password' },
        showcaseJwt: jwt({ link: { storyId: 's1' } }),
        credentials: [undefined, 'Showcase link'],
      }),
    ).resolves.toBe(false);
  });

  it('includes NSFW for a verified viewer, or for a token that proves it for this story', async () => {
    mocks.viewerIncludesNsfw.mockResolvedValue(true);
    await expect(open()).resolves.toBe(true);

    mocks.viewerIncludesNsfw.mockResolvedValue(false);
    await expect(
      open({
        showcaseJwt: jwt({ adult: { storyId: 's1', nsfwOk: true } }),
        credentials: ['Showcase adult'],
      }),
    ).resolves.toBe(true);
    await expect(
      open({
        showcaseJwt: jwt({ adult: { storyId: 's2', nsfwOk: true } }),
        credentials: ['Showcase adult'],
      }),
    ).resolves.toBe(false);
  });

  it('answers "not found" when the story is not visible to this viewer', async () => {
    mocks.isVisibleTo.mockResolvedValue(false);
    await expect(open()).rejects.toMatchObject({ status: 404 });
  });
});

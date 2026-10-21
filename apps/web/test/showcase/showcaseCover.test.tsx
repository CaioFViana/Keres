import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShowcaseStoryCard } from '@keres/shared';
import { StoryCard } from '@/showcase/components/StoryCard';
import { StoryCover } from '@/showcase/components/StoryCover';
import { ShowcaseThemeProvider } from '@/showcase/theme/ShowcaseThemeProvider';
import { flush, render } from '@test/helpers/react';

const mocks = vi.hoisted(() => ({ fetchCoverUrl: vi.fn() }));

vi.mock('@/showcase/api/showcaseApi', () => ({
  fetchCoverUrl: mocks.fetchCoverUrl,
}));

const revoke = vi.fn();

beforeEach(() => {
  mocks.fetchCoverUrl.mockReset().mockResolvedValue('blob:cover-1');
  revoke.mockReset();
  URL.revokeObjectURL = revoke;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const card = (hasCover: boolean | undefined): ShowcaseStoryCard => ({
  storyId: 'story-1',
  isNsfw: false,
  snapshot: {
    title: 'O Vale Silencioso',
    description: null,
    genre: null,
    language: null,
    author: null,
    type: 'linear',
    theme: null,
  },
  owner: { username: 'ana', tag: 'ana', avatarColor: null, avatarIcon: null },
  versionCount: 1,
  latestVersion: {
    id: 'pub-1',
    arc: null,
    label: 'v1',
    byteSize: 100,
    mediaIncluded: 0,
    mediaTotal: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    packageIncluded: true,
    manuscript: null,
    reader: null,
  },
  hasCover,
  updatedAt: '2026-10-01T00:00:00.000Z',
});

describe('the cover on the showcase', () => {
  it('draws the picture of a story that has a cover, once it has arrived', async () => {
    const view = await render(<StoryCover storyId="story-1" hasCover className="story-cover" />);
    await flush();

    const image = view.container.querySelector('img.story-cover');
    expect(image?.getAttribute('src')).toBe('blob:cover-1');
    expect(mocks.fetchCoverUrl).toHaveBeenCalledWith('story-1', undefined);
    await view.unmount();
  });

  it('draws nothing, and asks for nothing, for a story without a cover', async () => {
    const view = await render(
      <StoryCover storyId="story-1" hasCover={false} className="story-cover" />,
    );
    await flush();

    expect(view.container.querySelector('img')).toBeNull();
    expect(mocks.fetchCoverUrl).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('draws nothing when the cover cannot be had, and lets go of the address when it leaves', async () => {
    mocks.fetchCoverUrl.mockResolvedValueOnce(null);
    const missing = await render(<StoryCover storyId="story-1" hasCover className="story-cover" />);
    await flush();
    expect(missing.container.querySelector('img')).toBeNull();
    await missing.unmount();

    const shown = await render(<StoryCover storyId="story-1" hasCover className="story-cover" />);
    await flush();
    await shown.unmount();
    expect(revoke).toHaveBeenCalledWith('blob:cover-1');
  });

  it('sits on the card of the story, beside what it says', async () => {
    const view = await render(
      <MemoryRouter>
        <ShowcaseThemeProvider>
          <StoryCard story={card(true)} />
        </ShowcaseThemeProvider>
      </MemoryRouter>,
    );
    await flush();

    expect(view.container.querySelector('img.story-card-cover')).not.toBeNull();
    expect(view.container.textContent).toContain('O Vale Silencioso');
    await view.unmount();
  });

  it('leaves the card as it was for a server that does not say', async () => {
    const view = await render(
      <MemoryRouter>
        <ShowcaseThemeProvider>
          <StoryCard story={card(undefined)} />
        </ShowcaseThemeProvider>
      </MemoryRouter>,
    );
    await flush();

    expect(view.container.querySelector('img.story-card-cover')).toBeNull();
    await view.unmount();
  });
});

describe('the cover of a released work', () => {
  it('asks for the work, not for the story, and gives the address back when the page is gone first', async () => {
    let resolveCover: (address: string) => void = () => {};
    mocks.fetchCoverUrl.mockReturnValue(new Promise<string>((resolve) => (resolveCover = resolve)));
    const view = await render(
      <StoryCover storyId="story-1" workId="arc-1" hasCover className="work-cover" />,
    );
    expect(mocks.fetchCoverUrl).toHaveBeenCalledWith('story-1', 'arc-1');

    // The picture arrives after the page was left: nothing may keep its address.
    await view.unmount();
    resolveCover('blob:late');
    await Promise.resolve();
    await Promise.resolve();

    expect(revoke).toHaveBeenCalledWith('blob:late');
  });
});

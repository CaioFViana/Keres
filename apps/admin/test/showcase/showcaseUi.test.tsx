import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShowcaseStoryCard, ShowcaseStoryDetail } from '@keres/shared';
import { ShowcaseApp } from '../../src/showcase/App';
import { changeInput, click, flush, render, submit } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  fetchStories: vi.fn(),
  fetchStory: vi.fn(),
  unlockStory: vi.fn(),
  fetchDownloadUrl: vi.fn(),
  fetchConfig: vi.fn(),
}));

vi.mock('../../src/showcase/api/showcaseApi', () => ({
  fetchStories: mocks.fetchStories,
  fetchStory: mocks.fetchStory,
  unlockStory: mocks.unlockStory,
  fetchDownloadUrl: mocks.fetchDownloadUrl,
  fetchConfig: mocks.fetchConfig,
}));

const card: ShowcaseStoryCard = {
  storyId: 'story-1',
  snapshot: {
    title: 'O Vale Silencioso',
    description: 'Uma trilha que ninguém percorre duas vezes.',
    genre: 'Fantasy, Mystery',
    language: 'pt-BR',
    author: 'Ana',
    type: 'branching',
    theme: 'twilight',
  },
  owner: { username: 'ana', tag: 'ana', avatarColor: '#6200ee', avatarIcon: 'book-outline' },
  versionCount: 2,
  latestVersion: {
    id: 'pub-2',
    label: 'v7-2026-08-19',
    byteSize: 2048,
    mediaIncluded: 1,
    mediaTotal: 2,
    createdAt: '2026-08-19T10:00:00.000Z',
  },
  updatedAt: '2026-08-19T10:00:00.000Z',
};

const detail: ShowcaseStoryDetail = {
  storyId: 'story-1',
  snapshot: card.snapshot,
  owner: card.owner,
  versions: [
    card.latestVersion,
    {
      id: 'pub-1',
      label: 'v3-2026-08-01',
      byteSize: 1024,
      mediaIncluded: 0,
      mediaTotal: 0,
      createdAt: '2026-08-01T10:00:00.000Z',
    },
  ],
  updatedAt: '2026-08-19T10:00:00.000Z',
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ShowcaseApp />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchStories.mockResolvedValue({ stories: [card], etag: 'W/"showcase-1-x"' });
  mocks.fetchStory.mockResolvedValue(detail);
  mocks.fetchConfig.mockResolvedValue({ showcaseEnabled: true, serverVersion: '1.0.0' });
  mocks.fetchDownloadUrl.mockResolvedValue('/api/public/stories/story-1/x/download');
});

describe('showcase home', () => {
  it('lists a published story with its author, genres and latest version', async () => {
    const { container, unmount } = await renderAt('/');
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('O Vale Silencioso');
    expect(text).toContain('Ana');
    expect(text).toContain('Fantasy');
    expect(text).toContain('Mystery');
    expect(text).toContain('v7-2026-08-19');
    expect(text).toContain('2.0 KB');
    await unmount();
  });

  it('links each card to its story page', async () => {
    const { container, unmount } = await renderAt('/');
    await flush();

    const link = container.querySelector('a.story-card');
    expect(link?.getAttribute('href')).toBe('/story/story-1');
    await unmount();
  });

  it('says so when nothing has been published', async () => {
    mocks.fetchStories.mockResolvedValue({ stories: [], etag: null });
    const { container, unmount } = await renderAt('/');
    await flush();

    expect(container.textContent).toContain('Nothing has been published');
    await unmount();
  });

  it('surfaces a failure instead of an endless spinner', async () => {
    mocks.fetchStories.mockRejectedValue(new Error('Server is down.'));
    const { container, unmount } = await renderAt('/');
    await flush();

    expect(container.querySelector('.error-text')?.textContent).toBe('Server is down.');
    await unmount();
  });

  // The site is the server's public face; the administration panel is not part of it.
  it('links nowhere near /admin', async () => {
    const { container, unmount } = await renderAt('/');
    await flush();

    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((href) => href.includes('/admin'))).toBe(false);
    await unmount();
  });

  it('carries the disclaimer on every page', async () => {
    for (const path of ['/', '/story/story-1', '/about']) {
      const { container, unmount } = await renderAt(path);
      await flush();
      expect(container.querySelector('.disclaimer')?.textContent).toContain('not affiliated');
      await unmount();
    }
  });
});

describe('showcase story page', () => {
  it('shows the story detail and every version', async () => {
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('O Vale Silencioso');
    expect(text).toContain('Uma trilha que ninguém percorre duas vezes.');
    expect(text).toContain('pt-BR');
    expect(text).toContain('Branching');
    expect(text).toContain('Twilight');
    expect(text).toContain('v7-2026-08-19');
    expect(text).toContain('v3-2026-08-01');
    // 1 of 2 media files packaged: the number is the difference between a complete package and a
    // partial one.
    expect(text).toContain('1/2 media');
    await unmount();
  });

  it('asks the server for a fresh link when a download is requested', async () => {
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    const buttons = [...container.querySelectorAll('button')];
    const download = buttons.find((button) => button.textContent?.includes('Download latest'));
    await click(download!);
    await flush();

    expect(mocks.fetchDownloadUrl).toHaveBeenCalledWith('story-1', 'pub-2');
    await unmount();
  });

  it('tints the page with the story palette', async () => {
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    const page = container.querySelector('.story-page') as HTMLElement;
    expect(page.style.getPropertyValue('--story-primary')).toBeTruthy();
    await unmount();
  });
});

describe('password-protected story', () => {
  beforeEach(() => {
    mocks.fetchStory.mockResolvedValue({ storyId: 'story-1', protected: true });
  });

  it('reveals nothing about the story before the password is given', async () => {
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('This story is private');
    expect(text).not.toContain('O Vale Silencioso');
    expect(text).not.toContain('Ana');
    await unmount();
  });

  it('opens the story once the password is accepted', async () => {
    mocks.unlockStory.mockResolvedValue(detail);
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    await changeInput(container.querySelector('input')!, 'hunter2');
    await submit(container.querySelector('form')!);
    await flush();

    expect(mocks.unlockStory).toHaveBeenCalledWith('story-1', 'hunter2');
    expect(container.textContent).toContain('O Vale Silencioso');
    await unmount();
  });

  it('keeps the gate up on a wrong password', async () => {
    mocks.unlockStory.mockRejectedValue(new Error('Incorrect password.'));
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    await changeInput(container.querySelector('input')!, 'nope');
    await submit(container.querySelector('form')!);
    await flush();

    expect(container.querySelector('.error-text')?.textContent).toBe('Incorrect password.');
    expect(container.textContent).toContain('This story is private');
    await unmount();
  });
});

describe('author and uploader', () => {
  /**
   * They are different things: the author is the story's free text (a pen name, a team, a
   * public-domain work the person merely transcribed), and the publisher is the account that uploaded
   * the package. Confusing the two attributes to somebody a work that may not be theirs.
   */
  it('credits the story author and the uploading account separately', async () => {
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Ana'); // autor declarado na história
    expect(text).toContain('published this story'); // conta que publicou
    expect(text).toContain('#ana');
    await unmount();
  });

  it('never presents the account name as the author', async () => {
    const anonymous = {
      ...detail,
      snapshot: { ...detail.snapshot, author: null },
    };
    mocks.fetchStory.mockResolvedValue(anonymous);

    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    const facts = container.querySelector('.story-facts')?.textContent ?? '';
    expect(facts).not.toContain('Author');
    // The publisher is still stated - that is a fact about the page.
    expect(container.textContent).toContain('published this story');
    await unmount();
  });

  it('falls back to the uploader on a card with no declared author', async () => {
    mocks.fetchStories.mockResolvedValue({
      stories: [{ ...card, snapshot: { ...card.snapshot, author: null } }],
      etag: null,
    });

    const { container, unmount } = await renderAt('/');
    await flush();

    const foot = container.querySelector('.story-card-foot')?.textContent ?? '';
    expect(foot).toContain('ana');
    expect(foot).toContain('published this');
    await unmount();
  });
});

describe('owner avatar', () => {
  // The app lets a person choose an icon and a colour; the site draws both, not an initial.
  it('draws the chosen icon on the chosen color', async () => {
    const { container, unmount } = await renderAt('/');
    await flush();

    const avatar = container.querySelector('.avatar') as HTMLElement;
    expect(avatar.style.background).toBe('rgb(98, 0, 238)');
    expect(avatar.querySelector('svg')).not.toBeNull();
    expect(avatar.textContent).toBe('');
    await unmount();
  });

  it('gives a profile with no chosen color a stable one of its own', async () => {
    mocks.fetchStories.mockResolvedValue({
      stories: [{ ...card, owner: { ...card.owner, avatarColor: null, avatarIcon: null } }],
      etag: null,
    });

    const { container, unmount } = await renderAt('/');
    await flush();

    const avatar = container.querySelector('.avatar') as HTMLElement;
    expect(avatar.style.background).not.toBe('');
    // It still draws an icon: the default one, since the person picked none.
    expect(avatar.querySelector('svg')).not.toBeNull();
    await unmount();
  });
});

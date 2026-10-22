import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShowcaseAuthorPage, ShowcaseStoryCard } from '@keres/shared';
import { ShowcaseApp } from '@/showcase/App';
import { changeInput, click, flush, render } from '@test/helpers/react';

const mocks = vi.hoisted(() => ({
  fetchStories: vi.fn(),
  fetchFacets: vi.fn(async () => ({ genres: [], languages: [], mediums: [], types: [] })),
  fetchConfig: vi.fn(),
  fetchStory: vi.fn(),
  fetchPacks: vi.fn(),
  fetchAuthor: vi.fn(),
  fetchAuthors: vi.fn(),
}));

vi.mock('@/showcase/api/showcaseApi', () => ({
  fetchStories: mocks.fetchStories,
  fetchFacets: mocks.fetchFacets,
  fetchConfig: mocks.fetchConfig,
  fetchStory: mocks.fetchStory,
  fetchPacks: mocks.fetchPacks,
  fetchAuthor: mocks.fetchAuthor,
  fetchAuthors: mocks.fetchAuthors,
}));

const owner = { username: 'ana', tag: 'ana_s', avatarColor: '#6200ee', avatarIcon: 'book-outline' };

const card: ShowcaseStoryCard = {
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
  owner,
  versionCount: 1,
  latestVersion: {
    id: 'v1',
    label: 'v1',
    byteSize: 1024,
    mediaIncluded: 0,
    mediaTotal: 0,
    packageIncluded: true,
    createdAt: '2026-08-01T10:00:00.000Z',
    manuscript: null,
    reader: null,
  },
  updatedAt: '2026-08-01T10:00:00.000Z',
};

const page: ShowcaseAuthorPage = {
  owner,
  biography: 'I draw comics.\nNew chapter on Fridays.',
  links: [
    { label: 'My site', url: 'https://www.example.com/ana' },
    { label: 'Shop', url: 'https://shop.example.org' },
  ],
  theme: 'ocean',
  stories: [card],
  updatedAt: '2026-08-01T10:00:00.000Z',
};

async function renderAt(path: string) {
  const view = await render(
    <MemoryRouter initialEntries={[path]}>
      <ShowcaseApp />
    </MemoryRouter>,
  );
  await flush();
  await flush();
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchStories.mockResolvedValue({ stories: [card], etag: 'W/"1"', total: 1 });
  mocks.fetchConfig.mockResolvedValue({ showcaseEnabled: true, serverVersion: '1.8.0' });
  mocks.fetchStory.mockResolvedValue({ storyId: 'story-1', protected: true });
  mocks.fetchPacks.mockResolvedValue([]);
  mocks.fetchAuthor.mockResolvedValue(page);
  mocks.fetchAuthors.mockResolvedValue({
    authors: [{ owner, storyCount: 2, updatedAt: '2026-08-01T10:00:00.000Z' }],
    total: 1,
  });
});

describe('the author page', () => {
  it('shows who the author is, in their own words, and their stories', async () => {
    const { container, unmount } = await renderAt('/author/ana');

    expect(mocks.fetchAuthor).toHaveBeenCalledWith('ana');
    expect(container.querySelector('h1')?.textContent).toBe('ana');
    expect(container.textContent).toContain('#ana_s · 1 story');
    expect(container.querySelector('.author-biography')?.textContent).toBe(page.biography);
    expect(container.textContent).toContain('O Vale Silencioso');
    await unmount();
  });

  it('reads the biography as text, never as markup', async () => {
    mocks.fetchAuthor.mockResolvedValue({
      ...page,
      biography: '<img src=x onerror=alert(1)><b>loud</b>',
    });
    const { container, unmount } = await renderAt('/author/ana');

    expect(container.querySelector('.author-biography img')).toBeNull();
    expect(container.querySelector('.author-biography b')).toBeNull();
    expect(container.querySelector('.author-biography')?.textContent).toContain('<b>loud</b>');
    await unmount();
  });

  it('opens each link in a new tab that knows nothing of this one, with the host beside the label', async () => {
    const { container, unmount } = await renderAt('/author/ana');

    const links = [...container.querySelectorAll('.author-links a')] as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://www.example.com/ana',
      'https://shop.example.org',
    ]);
    for (const link of links) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
      expect(link.rel).toContain('noreferrer');
      expect(link.rel).toContain('nofollow');
    }
    expect(links[0].textContent).toContain('My site');
    expect(links[0].textContent).toContain('example.com');
    expect(links[0].textContent).not.toContain('www.');
    await unmount();
  });

  it('wears the palette the author chose, and only then', async () => {
    const themed = await renderAt('/author/ana');
    const section = themed.container.querySelector('[data-testid="author-page"]') as HTMLElement;
    expect(section.className).toContain('themed');
    expect(section.style.getPropertyValue('--story-primary')).not.toBe('');
    await themed.unmount();

    mocks.fetchAuthor.mockResolvedValue({ ...page, theme: null });
    const plain = await renderAt('/author/ana');
    const bare = plain.container.querySelector('[data-testid="author-page"]') as HTMLElement;
    expect(bare.className).not.toContain('themed');
    expect(bare.style.getPropertyValue('--story-primary')).toBe('');
    await plain.unmount();
  });

  it('leaves out the sections the author did not write', async () => {
    mocks.fetchAuthor.mockResolvedValue({ ...page, biography: null, links: [] });
    const { container, unmount } = await renderAt('/author/ana');

    expect(container.querySelector('.author-biography')).toBeNull();
    expect(container.querySelector('.author-links')).toBeNull();
    await unmount();
  });

  it('says so when the author has nothing on show', async () => {
    mocks.fetchAuthor.mockRejectedValue(new Error('Not found.'));
    const { container, unmount } = await renderAt('/author/nobody');

    expect(container.textContent).toContain('This author has nothing on show.');
    await unmount();
  });

  it('is reached from the author of a story card without opening the story', async () => {
    const { container, unmount } = await renderAt('/');

    const owner = container.querySelector('.story-card .owner') as HTMLElement;
    await click(owner);
    await flush();

    expect(mocks.fetchAuthor).toHaveBeenCalledWith('ana');
    expect(mocks.fetchStory).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="author-page"]')).not.toBeNull();
    await unmount();
  });
});

describe('the directory of authors', () => {
  it('lists the authors with how many stories each has', async () => {
    const { container, unmount } = await renderAt('/authors');

    expect(mocks.fetchAuthors).toHaveBeenCalledWith('', 48);
    const author = container.querySelector('.author-card') as HTMLAnchorElement;
    expect(author.textContent).toContain('ana');
    expect(author.textContent).toContain('2 stories');
    await unmount();
  });

  it('searches by name once typing pauses', async () => {
    const { container, unmount } = await renderAt('/authors');
    const box = container.querySelector('input[type="search"]') as HTMLInputElement;

    await changeInput(box, 'an');
    await new Promise((resolve) => setTimeout(resolve, 400));
    await flush();

    expect(mocks.fetchAuthors.mock.calls.at(-1)).toEqual(['an', 48]);
    await unmount();
  });

  it('says so when nobody has published', async () => {
    mocks.fetchAuthors.mockResolvedValue({ authors: [], total: 0 });
    const { container, unmount } = await renderAt('/authors');

    expect(container.textContent).toContain('No author has published anything yet.');
    await unmount();
  });
});

describe('the rest of the author pages', () => {
  it('shows a link whose address does not parse without a host', async () => {
    mocks.fetchAuthor.mockResolvedValue({
      ...page,
      links: [{ label: 'Odd', url: 'not a url' }],
    });
    const { container, unmount } = await renderAt('/author/ana');

    expect(container.querySelector('.author-link-host')?.textContent).toBe('');
    await unmount();
  });

  it('offers more authors when there are more than loaded, and asks for the next page', async () => {
    mocks.fetchAuthors.mockResolvedValue({
      authors: [{ owner, storyCount: 2, updatedAt: '2026-08-01T10:00:00.000Z' }],
      total: 100,
    });
    const { container, unmount } = await renderAt('/authors');

    const more = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Show more authors',
    ) as HTMLButtonElement;
    await click(more);
    await flush();

    expect(mocks.fetchAuthors.mock.calls.at(-1)).toEqual(['', 96]);
    await unmount();
  });

  it('reports a failure to load the directory, and says nothing matched a search', async () => {
    mocks.fetchAuthors.mockRejectedValue(new Error('down'));
    const failed = await renderAt('/authors');
    expect(failed.container.textContent).toContain('down');
    await failed.unmount();

    mocks.fetchAuthors.mockResolvedValue({ authors: [], total: 0 });
    const none = await renderAt('/authors?q=zzz');
    expect(none.container.textContent).toContain('No author matches this search.');
    await none.unmount();
  });
});

describe('the search form of the directory', () => {
  it('does not reload the page when it is submitted', async () => {
    const { container, unmount } = await renderAt('/authors');
    const form = container.querySelector('form') as HTMLFormElement;

    const event = new Event('submit', { bubbles: true, cancelable: true });
    await act(async () => {
      form.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    await unmount();
  });
});

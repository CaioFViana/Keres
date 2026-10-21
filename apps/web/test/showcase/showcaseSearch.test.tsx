import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShowcaseStoryCard } from '@keres/shared';
import { ShowcaseApp } from '@/showcase/App';
import { NO_FILTERS } from '@/showcase/storyFilters';
import { changeInput, click, flush, render } from '@test/helpers/react';

const mocks = vi.hoisted(() => ({
  fetchStories: vi.fn(),
  fetchFacets: vi.fn(),
  fetchConfig: vi.fn(),
  fetchStory: vi.fn(),
  fetchPacks: vi.fn(),
  fetchPack: vi.fn(),
  fetchAuthor: vi.fn(),
  fetchAuthors: vi.fn(),
}));

vi.mock('@/showcase/api/showcaseApi', () => ({
  fetchStories: mocks.fetchStories,
  fetchFacets: mocks.fetchFacets,
  fetchConfig: mocks.fetchConfig,
  fetchStory: mocks.fetchStory,
  fetchPacks: mocks.fetchPacks,
  fetchPack: mocks.fetchPack,
  fetchAuthor: mocks.fetchAuthor,
  fetchAuthors: mocks.fetchAuthors,
}));

const card: ShowcaseStoryCard = {
  storyId: 'story-1',
  isNsfw: false,
  snapshot: {
    title: 'O Vale Silencioso',
    description: null,
    genre: 'Fantasia',
    language: 'Português',
    author: null,
    type: 'linear',
    theme: null,
  },
  owner: { username: 'ana', tag: 'ana', avatarColor: '#6200ee', avatarIcon: 'book-outline' },
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

const facets = {
  genres: [
    { value: 'Fantasia', count: 3 },
    { value: 'Romance', count: 1 },
  ],
  languages: [{ value: 'Português', count: 4 }],
  mediums: [{ value: 'comic', count: 1 }],
  types: [{ value: 'linear', count: 4 }],
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

const lastFilters = () => mocks.fetchStories.mock.calls.at(-1)?.[1];
const select = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll('label.filter-field')]
    .find((field) => field.querySelector('span')?.textContent === label)
    ?.querySelector('select') as HTMLSelectElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchStories.mockResolvedValue({ stories: [card], etag: 'W/"1"', total: 1 });
  mocks.fetchFacets.mockResolvedValue(facets);
  mocks.fetchConfig.mockResolvedValue({ showcaseEnabled: true, serverVersion: '1.8.0' });
  mocks.fetchStory.mockResolvedValue({ storyId: 'story-1', protected: true });
  mocks.fetchPacks.mockResolvedValue([]);
});

describe('the search of the home page', () => {
  it('asks for the whole list at first and offers the facets as options, with their counts', async () => {
    const { container, unmount } = await renderAt('/');

    expect(mocks.fetchStories).toHaveBeenCalledWith(null, NO_FILTERS, 24);
    const options = [...select(container, 'Genre').options].map((option) => option.textContent);
    expect(options).toEqual(['Any', 'Fantasia (3)', 'Romance (1)']);
    await unmount();
  });

  it('asks again, with the filter, when one is picked, and keeps it in the address', async () => {
    const { container, unmount } = await renderAt('/');

    await changeInput(select(container, 'Genre'), 'Romance');
    await flush();

    expect(lastFilters()).toEqual({ ...NO_FILTERS, genre: 'Romance' });
    expect(select(container, 'Genre').value).toBe('Romance');
    await unmount();
  });

  it('starts from the filters the address carries', async () => {
    const { container, unmount } = await renderAt('/?genre=Fantasia&sort=title&q=vale');

    expect(lastFilters()).toEqual({ ...NO_FILTERS, genre: 'Fantasia', sort: 'title', q: 'vale' });
    expect((container.querySelector('input[type="search"]') as HTMLInputElement).value).toBe(
      'vale',
    );
    await unmount();
  });

  it('waits for typing to pause before it asks', async () => {
    const { container, unmount } = await renderAt('/');
    const box = container.querySelector('input[type="search"]') as HTMLInputElement;
    const calls = mocks.fetchStories.mock.calls.length;

    await changeInput(box, 'va');
    await changeInput(box, 'vale');
    expect(mocks.fetchStories.mock.calls.length).toBe(calls);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    await flush();

    expect(lastFilters()).toEqual({ ...NO_FILTERS, q: 'vale' });
    await unmount();
  });

  it('says so when nothing matches, and the clear button brings the whole list back', async () => {
    mocks.fetchStories.mockResolvedValue({ stories: [], etag: 'W/"2"', total: 0 });
    const { container, unmount } = await renderAt('/?genre=Horror');

    expect(container.textContent).toContain('No story matches this search.');
    const clear = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Clear filters',
    ) as HTMLButtonElement;
    await click(clear);
    await flush();

    expect(lastFilters()).toEqual(NO_FILTERS);
    expect(container.textContent).not.toContain('Clear filters');
    await unmount();
  });

  it('offers more when the server holds more than was loaded, and asks for the next page', async () => {
    mocks.fetchStories.mockResolvedValue({ stories: [card], etag: 'W/"3"', total: 30 });
    const { container, unmount } = await renderAt('/');

    const more = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Show more stories',
    ) as HTMLButtonElement;
    expect(more).toBeTruthy();
    await click(more);
    await flush();

    expect(mocks.fetchStories.mock.calls.at(-1)?.[2]).toBe(48);
    await unmount();
  });

  it('still lists the stories when the facets cannot be loaded', async () => {
    mocks.fetchFacets.mockRejectedValue(new Error('down'));
    const { container, unmount } = await renderAt('/');

    expect(container.textContent).toContain('O Vale Silencioso');
    expect([...select(container, 'Genre').options].map((option) => option.textContent)).toEqual([
      'Any',
    ]);
    await unmount();
  });
});

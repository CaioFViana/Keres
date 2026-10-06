import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShowcaseStoryDetail, ShowcaseVersion } from '@keres/shared';
import { ShowcaseApp } from '../../src/showcase/App';
import { groupVersions } from '../../src/showcase/pages/StoryPage';
import { flush, render } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  fetchStories: vi.fn(),
  fetchStory: vi.fn(),
  unlockStory: vi.fn(),
  fetchDownloadUrl: vi.fn(),
  fetchManuscriptDownloadUrl: vi.fn(),
  fetchConfig: vi.fn(),
  fetchPacks: vi.fn(),
  fetchPack: vi.fn(),
}));

vi.mock('../../src/showcase/api/showcaseApi', () => ({
  fetchStories: mocks.fetchStories,
  fetchStory: mocks.fetchStory,
  unlockStory: mocks.unlockStory,
  fetchDownloadUrl: mocks.fetchDownloadUrl,
  fetchManuscriptDownloadUrl: mocks.fetchManuscriptDownloadUrl,
  fetchConfig: mocks.fetchConfig,
  fetchPacks: mocks.fetchPacks,
  fetchPack: mocks.fetchPack,
}));

const bookOne = {
  id: 'arc-1',
  title: 'Book One',
  description: 'Where it starts.',
  author: 'Ana Illustrator',
  medium: 'comic' as const,
};
const bookTwo = {
  id: 'arc-2',
  title: 'Book Two',
  description: null,
  author: null,
  medium: 'screenplay' as const,
};

function version(id: string, overrides: Partial<ShowcaseVersion> = {}): ShowcaseVersion {
  return {
    id,
    arc: null,
    label: `label-${id}`,
    byteSize: 1024,
    mediaIncluded: 0,
    mediaTotal: 0,
    packageIncluded: true,
    createdAt: '2026-08-01T10:00:00.000Z',
    manuscript: null,
    reader: null,
    ...overrides,
  };
}

describe('groupVersions', () => {
  it('puts the universe first, then each work, newest version leading inside each', () => {
    const groups = groupVersions([
      version('w2-new', { arc: bookTwo, packageIncluded: false }),
      version('u-new'),
      version('w1-new', { arc: bookOne, packageIncluded: false }),
      version('w2-old', { arc: bookTwo, packageIncluded: false }),
      version('u-old'),
    ]);

    expect(groups.map((group) => group.key)).toEqual(['universe', 'arc-2', 'arc-1']);
    expect(groups[0].versions.map((entry) => entry.id)).toEqual(['u-new', 'u-old']);
    expect(groups[1].versions.map((entry) => entry.id)).toEqual(['w2-new', 'w2-old']);
  });

  it('has no universe group when only works were released, and treats a missing arc as the universe', () => {
    expect(groupVersions([version('w1', { arc: bookOne })]).map((group) => group.key)).toEqual([
      'arc-1',
    ]);
    const legacy = { ...version('old') } as Partial<ShowcaseVersion>;
    delete legacy.arc;
    expect(groupVersions([legacy as ShowcaseVersion]).map((group) => group.key)).toEqual([
      'universe',
    ]);
  });
});

function detailOf(versions: ShowcaseVersion[]): ShowcaseStoryDetail {
  return {
    storyId: 'story-1',
    snapshot: {
      title: 'The Universe',
      description: null,
      genre: null,
      language: 'en',
      author: 'Story Author',
      type: 'linear',
      theme: null,
    },
    owner: { username: 'ana', tag: 'ana', avatarColor: '#6200ee', avatarIcon: 'book-outline' },
    versions,
    updatedAt: '2026-08-19T10:00:00.000Z',
  };
}

async function renderStory(detail: ShowcaseStoryDetail) {
  mocks.fetchStory.mockResolvedValue(detail);
  const view = await render(
    <MemoryRouter initialEntries={['/story/story-1']}>
      <ShowcaseApp />
    </MemoryRouter>,
  );
  await flush();
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchStories.mockResolvedValue({ stories: [], etag: 'W/"showcase-0"' });
  mocks.fetchConfig.mockResolvedValue({ showcaseEnabled: true, serverVersion: '1.8.0' });
  mocks.fetchPacks.mockResolvedValue([]);
});

describe('story page works', () => {
  it('lists each work under its own heading, with its form and author', async () => {
    const { container, unmount } = await renderStory(
      detailOf([
        version('u-1'),
        version('w1', {
          arc: bookOne,
          packageIncluded: false,
          reader: { byteSize: 10 },
        }),
        version('w2', { arc: bookTwo, packageIncluded: false }),
      ]),
    );

    const first = container.querySelector('[data-testid="work-arc-1"]');
    expect(first?.querySelector('h2')?.textContent).toBe('Book One');
    expect(first?.textContent).toContain('Comic');
    expect(first?.textContent).toContain('Ana Illustrator');
    expect(first?.textContent).toContain('Where it starts.');
    // A work offers no story file, only what was released for it.
    expect(first?.querySelector('.download-button:not(.reader-button)')).toBeNull();
    expect(first?.querySelector('.reader-button')?.getAttribute('href')).toBe(
      '/story/story-1/read/w1',
    );
    const second = container.querySelector('[data-testid="work-arc-2"]');
    expect(second?.querySelector('h2')?.textContent).toBe('Book Two');
    expect(second?.textContent).toContain('Screenplay');
    expect(container.querySelector('[data-testid="universe-versions"] h2')?.textContent).toBe(
      'The whole universe',
    );
    await unmount();
  });

  it('keeps the plain download list for a story that never released a work', async () => {
    const { container, unmount } = await renderStory(detailOf([version('u-1'), version('u-0')]));

    expect(container.querySelectorAll('.versions')).toHaveLength(1);
    expect(container.querySelector('[data-testid="universe-versions"] h2')?.textContent).toBe(
      'Download',
    );
    expect(container.querySelector('[data-testid^="work-"]')).toBeNull();
    expect(container.querySelectorAll('.version')).toHaveLength(2);
    await unmount();
  });
});

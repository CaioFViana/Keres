import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AttributeType,
  type ShowcasePackDetail,
  type ShowcaseStoryCard,
  type ShowcaseStoryDetail,
} from '@keres/shared';
import { ShowcaseApp } from '../../src/showcase/App';
import { click, flush, render } from '../helpers/react';

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

const card: ShowcaseStoryCard = {
  storyId: 'story-1',
  snapshot: {
    title: 'O Vale Silencioso',
    description: 'Uma trilha que ninguém percorre duas vezes.',
    genre: 'Fantasy',
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
    manuscript: null,
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
      manuscript: null,
    },
  ],
  updatedAt: '2026-08-19T10:00:00.000Z',
};

const rowDates = {
  createdAt: new Date('2026-08-01T10:00:00.000Z'),
  updatedAt: new Date('2026-08-01T10:00:00.000Z'),
  version: 1,
  isDeleted: false,
  deletedAt: null,
};

/** Two fields on the same entity and two axes, both deliberately out of order. */
const unorderedPack: ShowcasePackDetail = {
  id: 'pack-1',
  name: 'Tabletop stats',
  description: null,
  language: null,
  authorName: null,
  version: 1,
  owner: { username: 'ana', tag: '1234', avatarColor: '#6200ee', avatarIcon: 'book-outline' },
  summary: {
    fieldCount: 2,
    suggestionCount: 0,
    tagCount: 0,
    statCount: 2,
    hasVocabulary: false,
    statSystem: false,
    statNotation: 'number',
    chapterCount: 0,
    sceneCount: 0,
    characterCount: 0,
    locationCount: 0,
    worldRuleCount: 0,
    noteCount: 0,
    boardCount: 0,
    locationMapCount: 0,
  },
  updatedAt: '2026-08-19T10:00:00.000Z',
  content: {
    formatVersion: 1,
    storySchemaFields: [
      {
        id: 'field-2',
        storyId: 'story-1',
        entityType: 'Character',
        key: 'second',
        name: 'Second',
        type: AttributeType.TEXT,
        description: null,
        targetEntityType: null,
        isRequired: false,
        defaultValue: null,
        order: 1,
        ...rowDates,
      },
      {
        id: 'field-1',
        storyId: 'story-1',
        entityType: 'Character',
        key: 'first',
        name: 'First',
        type: AttributeType.TEXT,
        description: null,
        targetEntityType: null,
        isRequired: false,
        defaultValue: null,
        order: 0,
        ...rowDates,
      },
    ],
    suggestions: [],
    tags: [],
    stats: [
      {
        id: 'stat-2',
        storyId: 'story-1',
        name: 'Zulu',
        isPrimary: true,
        order: 1,
        ...rowDates,
      },
      {
        id: 'stat-1',
        storyId: 'story-1',
        name: 'Alpha',
        isPrimary: true,
        order: 0,
        ...rowDates,
      },
    ],
    statStrengths: [],
    settings: {
      statSystem: false,
      statNotation: 'number',
      vocabulary: { version: 1, language: 'en', terms: {} },
    },
    extras: {
      chapters: [],
      scenes: [],
      characters: [],
      locations: [],
      worldRules: [],
      notes: [],
      storyBoards: [],
      storyLocationMaps: [],
      characterScenes: [],
      characterRelations: [],
      locationRelations: [],
      noteRelations: [],
      tagRelations: [],
    },
  },
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
  mocks.fetchStories.mockResolvedValue({ stories: [card], etag: 'W/"showcase-1"' });
  mocks.fetchStory.mockResolvedValue(detail);
  mocks.fetchConfig.mockResolvedValue({ showcaseEnabled: true, serverVersion: '1.8.0' });
  mocks.fetchPacks.mockResolvedValue([]);
  mocks.fetchPack.mockResolvedValue(unorderedPack);
  mocks.fetchDownloadUrl.mockResolvedValue('/api/public/stories/story-1/x/download');
  mocks.fetchManuscriptDownloadUrl.mockResolvedValue(
    '/api/public/stories/story-1/x/manuscript/download',
  );
});

describe('showcase listing refresh', () => {
  it('keeps the list it has when a poll answers 304', async () => {
    const { container, unmount } = await renderAt('/');
    await flush();
    expect(container.textContent).toContain('O Vale Silencioso');

    mocks.fetchStories.mockResolvedValueOnce({ stories: null, etag: 'W/"showcase-1"' });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await flush();

    expect(mocks.fetchStories).toHaveBeenCalledTimes(2);
    expect(mocks.fetchStories).toHaveBeenLastCalledWith('W/"showcase-1"');
    expect(container.textContent).toContain('O Vale Silencioso');
    await unmount();
  });

  it('shows new publications when coming back to the tab', async () => {
    const { container, unmount } = await renderAt('/');
    await flush();

    const second = { ...card, storyId: 'story-2', snapshot: { ...card.snapshot, title: 'New' } };
    mocks.fetchStories.mockResolvedValueOnce({ stories: [card, second], etag: 'W/"showcase-2"' });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await flush();

    expect(container.textContent).toContain('New');
    await unmount();
  });

  it('re-polls on its interval', async () => {
    vi.useFakeTimers();
    try {
      const { container, unmount } = await renderAt('/');
      await flush();
      expect(mocks.fetchStories).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
      await flush();

      expect(mocks.fetchStories).toHaveBeenCalledTimes(2);
      expect(container.textContent).toContain('O Vale Silencioso');
      await unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('still says something when the failure carries no message', async () => {
    mocks.fetchStories.mockRejectedValue(undefined);
    const { container, unmount } = await renderAt('/');
    await flush();

    const error = container.querySelector('.error-text');
    expect(error).not.toBeNull();
    expect(error?.textContent).not.toBe('');
    await unmount();
  });
});

describe('showcase failure pages', () => {
  it('omits the server version when the config cannot be read', async () => {
    mocks.fetchConfig.mockRejectedValue(new Error('down'));
    const { container, unmount } = await renderAt('/about');
    await flush();

    expect(container.textContent).toContain('About');
    expect(container.querySelector('.muted')).toBeNull();
    await unmount();
  });

  it('still says something when the pack listing fails without a message', async () => {
    mocks.fetchPacks.mockRejectedValue(undefined);
    const { container, unmount } = await renderAt('/packs');
    await flush();

    const error = container.querySelector('.error-text');
    expect(error).not.toBeNull();
    expect(error?.textContent).not.toBe('');
    await unmount();
  });

  it('re-fetches the packs when coming back to the tab', async () => {
    const { unmount } = await renderAt('/packs');
    await flush();
    expect(mocks.fetchPacks).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await flush();

    expect(mocks.fetchPacks).toHaveBeenCalledTimes(2);
    await unmount();
  });

  it('shows an error page with a way back when the story cannot be read', async () => {
    mocks.fetchStory.mockRejectedValue(new Error('Not found.'));
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    expect(container.querySelector('.error-text')?.textContent).toBe('Not found.');
    expect(container.querySelector('a.back-link')?.getAttribute('href')).toBe('/');
    await unmount();
  });

  it('reports a download failure on the story page', async () => {
    mocks.fetchDownloadUrl.mockRejectedValue(new Error('Link expired.'));
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    await click(container.querySelector('.version.newest .download-button')!);
    await flush();

    expect(mocks.fetchDownloadUrl).toHaveBeenCalledWith('story-1', 'pub-2');
    expect(container.querySelector('.error-text')?.textContent).toBe('Link expired.');
    await unmount();
  });

  it('falls back to its own messages when failures carry none', async () => {
    mocks.fetchStory.mockRejectedValue(undefined);
    const failed = await renderAt('/story/story-1');
    await flush();
    expect(failed.container.querySelector('.error-text')?.textContent).toBe(
      'Could not load this story.',
    );
    await failed.unmount();

    mocks.fetchStory.mockResolvedValue(detail);
    mocks.fetchDownloadUrl.mockRejectedValue(undefined);
    const view = await renderAt('/story/story-1');
    await flush();
    await click(view.container.querySelector('.version.newest .download-button')!);
    await flush();
    expect(view.container.querySelector('.error-text')?.textContent).toBe(
      'Could not start the download.',
    );
    await view.unmount();
  });

  it('downloads an older version through its own button', async () => {
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    await click(container.querySelector('.version:not(.newest) .download-button')!);
    await flush();

    expect(mocks.fetchDownloadUrl).toHaveBeenCalledWith('story-1', 'pub-1');
    await unmount();
  });
});

describe('story manuscript download', () => {
  const withManuscripts: ShowcaseStoryDetail = {
    ...detail,
    versions: [
      { ...detail.versions[0], manuscript: { format: 'docx', byteSize: 1536 } },
      { ...detail.versions[1], manuscript: { format: 'md', byteSize: 512 } },
    ],
  };

  it('offers no manuscript button when no version carries one', async () => {
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    expect(container.querySelector('.manuscript-button')).toBeNull();
    await unmount();
  });

  it('shows one manuscript button per version carrying one, naming format and size', async () => {
    mocks.fetchStory.mockResolvedValue(withManuscripts);
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    const buttons = [...container.querySelectorAll('.manuscript-button')].map(
      (node) => node.textContent,
    );
    expect(buttons).toEqual(['Manuscript (DOCX · 1.5 KB)', 'Manuscript (MD · 512 B)']);
    await unmount();
  });

  it('downloads a version manuscript through its own button', async () => {
    mocks.fetchStory.mockResolvedValue(withManuscripts);
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    await click(container.querySelector('.version:not(.newest) .manuscript-button')!);
    await flush();

    expect(mocks.fetchManuscriptDownloadUrl).toHaveBeenCalledWith('story-1', 'pub-1');
    await unmount();
  });

  it('reports a manuscript failure on the story page', async () => {
    mocks.fetchStory.mockResolvedValue(withManuscripts);
    mocks.fetchManuscriptDownloadUrl.mockRejectedValue(new Error('Link expired.'));
    const { container, unmount } = await renderAt('/story/story-1');
    await flush();

    await click(container.querySelector('.version.newest .manuscript-button')!);
    await flush();

    expect(container.querySelector('.error-text')?.textContent).toBe('Link expired.');
    await unmount();
  });
});

describe('pack page ordering', () => {
  it('lists fields and axes in the app order, not the payload order', async () => {
    const { container, unmount } = await renderAt('/pack/pack-1');
    await flush();

    const fields = [...container.querySelectorAll('.pack-group .pack-field-name')].map(
      (node) => node.textContent,
    );
    expect(fields).toEqual(['First', 'Second']);

    const stats = [...container.querySelectorAll('.pack-stat-list .pack-field-name')].map(
      (node) => node.textContent,
    );
    expect(stats).toEqual(['Alpha', 'Zulu']);
    await unmount();
  });

  it('shows plain catalogues, secondary axes and uncolored tags as they are', async () => {
    mocks.fetchPack.mockResolvedValue({
      ...unorderedPack,
      content: {
        ...unorderedPack.content,
        suggestions: [
          {
            id: 's1',
            storyId: 'story-1',
            type: 'names',
            value: 'Ana',
            createdAt: new Date('2026-08-01T10:00:00.000Z'),
            updatedAt: new Date('2026-08-01T10:00:00.000Z'),
            version: 1,
            isDeleted: false,
            deletedAt: null,
          },
        ],
        tags: [
          {
            id: 'tag-1',
            storyId: 'story-1',
            name: 'Undead',
            color: null,
            isFavorite: false,
            extraNotes: null,
            createdAt: new Date('2026-08-01T10:00:00.000Z'),
            updatedAt: new Date('2026-08-01T10:00:00.000Z'),
            version: 1,
            isDeleted: false,
            deletedAt: null,
          },
        ],
        stats: unorderedPack.content.stats.map((stat) => ({ ...stat, isPrimary: false })),
      },
    });
    const { container, unmount } = await renderAt('/pack/pack-1');
    await flush();

    expect(container.textContent).toContain('names');
    expect(container.querySelector('.pack-stat-list')?.textContent).toContain('secondary');
    expect(container.querySelector('.chip')?.getAttribute('style')).toBeNull();
    await unmount();
  });

  it('falls back to its own message when the pack fails without one', async () => {
    mocks.fetchPack.mockRejectedValue(undefined);
    const { container, unmount } = await renderAt('/pack/pack-1');
    await flush();

    expect(container.querySelector('.error-text')?.textContent).toBe('Could not load this pack.');
    await unmount();
  });

  it('skips a vocabulary term that arrived empty', async () => {
    mocks.fetchPack.mockResolvedValue({
      ...unorderedPack,
      content: {
        ...unorderedPack.content,
        settings: {
          statSystem: false,
          statNotation: 'number',
          vocabulary: {
            version: 1,
            language: 'en',
            terms: { Character: null },
          },
        },
      },
    });
    const { container, unmount } = await renderAt('/pack/pack-1');
    await flush();

    expect(container.textContent).toContain('Tabletop stats');
    expect(container.textContent).not.toContain('Hero');
    await unmount();
  });
});

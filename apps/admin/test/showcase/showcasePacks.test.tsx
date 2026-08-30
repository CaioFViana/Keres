import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AttributeType,
  type PackContentType,
  type ShowcasePackCard,
  type ShowcasePackDetail,
  type StorySchemaEntityType,
} from '@keres/shared';
import { ShowcaseApp } from '../../src/showcase/App';
import { flush, render } from '../helpers/react';

/**
 * The public packs on the Showcase.
 *
 * What these hold in place is that the page is *readable rather than a teaser*: a visitor with no
 * account sees the whole structure a pack carries, and is never offered a download that would have
 * nowhere to go. The author/uploader distinction is asserted here too, for the same reason it is
 * asserted for stories - the two are different people often enough to matter.
 */

const mocks = vi.hoisted(() => ({
  fetchStories: vi.fn(),
  fetchStory: vi.fn(),
  unlockStory: vi.fn(),
  fetchDownloadUrl: vi.fn(),
  fetchConfig: vi.fn(),
  fetchPacks: vi.fn(),
  fetchPack: vi.fn(),
}));

vi.mock('../../src/showcase/api/showcaseApi', () => ({
  fetchStories: mocks.fetchStories,
  fetchStory: mocks.fetchStory,
  unlockStory: mocks.unlockStory,
  fetchDownloadUrl: mocks.fetchDownloadUrl,
  fetchConfig: mocks.fetchConfig,
  fetchPacks: mocks.fetchPacks,
  fetchPack: mocks.fetchPack,
}));

const owner = { username: 'ana', tag: '1234', avatarColor: '#6200ee', avatarIcon: 'book-outline' };

const card: ShowcasePackCard = {
  id: 'pack-1',
  name: 'Tabletop stats',
  description: 'Six axes and a ladder of letters.',
  language: 'en',
  authorName: 'Ana the GM',
  version: 3,
  owner,
  summary: {
    fieldCount: 2,
    suggestionCount: 4,
    tagCount: 1,
    statCount: 6,
    statSystem: true,
    statNotation: 'letter',
  },
  updatedAt: '2026-08-19T10:00:00.000Z',
};

const rowDates = {
  createdAt: new Date('2026-08-01T10:00:00.000Z'),
  updatedAt: new Date('2026-08-01T10:00:00.000Z'),
  version: 1,
  isDeleted: false,
  deletedAt: null,
};

/** The rows a pack carries are whole entities, so the fixtures are built as whole entities. */
const field = (over: {
  id: string;
  entityType: StorySchemaEntityType;
  name: string;
  type: AttributeType;
  description?: string | null;
  isRequired?: boolean;
}): PackContentType['storySchemaFields'][number] => ({
  storyId: 'story-1',
  key: over.name.toLowerCase(),
  description: over.description ?? null,
  targetEntityType: null,
  isRequired: over.isRequired ?? false,
  defaultValue: null,
  order: 0,
  ...over,
  ...rowDates,
});

const suggestion = (
  id: string,
  type: string,
  value: string,
): PackContentType['suggestions'][number] => ({
  id,
  storyId: 'story-1',
  type,
  value,
  ...rowDates,
});

const detail: ShowcasePackDetail = {
  ...card,
  content: {
    formatVersion: 1,
    storySchemaFields: [
      field({
        id: 'field-1',
        entityType: 'Character',
        name: 'Alignment',
        description: 'Where they stand when nobody is watching.',
        type: AttributeType.SUGGESTION,
        isRequired: true,
      }),
      field({
        id: 'field-2',
        entityType: 'Location',
        name: 'Danger',
        type: AttributeType.NUMBER,
      }),
    ],
    suggestions: [
      suggestion('s1', 'custom:field-1', 'Lawful'),
      suggestion('s2', 'custom:field-1', 'Chaotic'),
      suggestion('s3', 'custom:gone', 'Orphan'),
    ],
    tags: [
      {
        id: 'tag-1',
        storyId: 'story-1',
        name: 'Undead',
        color: '#8844aa',
        isFavorite: false,
        extraNotes: null,
        createdAt: rowDates.createdAt,
        updatedAt: rowDates.updatedAt,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      },
    ],
    stats: [
      {
        id: 'stat-1',
        storyId: 'story-1',
        name: 'Strength',
        isPrimary: true,
        order: 0,
        createdAt: rowDates.createdAt,
        updatedAt: rowDates.updatedAt,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      },
    ],
    statStrengths: [
      {
        id: 'tier-1',
        storyId: 'story-1',
        statId: null,
        label: 'Feeble',
        minValue: 0,
        createdAt: rowDates.createdAt,
        updatedAt: rowDates.updatedAt,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      },
      {
        id: 'tier-2',
        storyId: 'story-1',
        statId: 'stat-1',
        label: 'Titanic',
        minValue: 90,
        createdAt: rowDates.createdAt,
        updatedAt: rowDates.updatedAt,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      },
    ],
    settings: { statSystem: true, statNotation: 'letter' },
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
  mocks.fetchPacks.mockResolvedValue([card]);
  mocks.fetchPack.mockResolvedValue(detail);
  mocks.fetchConfig.mockResolvedValue({ showcaseEnabled: true, serverVersion: '1.0.0' });
});

describe('the pack listing', () => {
  it('says what a pack contains without opening it', async () => {
    const { container, unmount } = await renderAt('/packs');
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Tabletop stats');
    expect(text).toContain('2 fields');
    expect(text).toContain('6 stat axes');
    expect(text).toContain('1 tag');
    expect(text).toContain('4 suggestions');
    await unmount();
  });

  /** A count of zero is absence, not information - the card should not carry it. */
  it('leaves out what the pack has none of', async () => {
    mocks.fetchPacks.mockResolvedValue([
      { ...card, summary: { ...card.summary, tagCount: 0, statCount: 0, statSystem: false } },
    ]);
    const { container, unmount } = await renderAt('/packs');
    await flush();

    const text = container.textContent ?? '';
    expect(text).not.toContain('0 tags');
    expect(text).not.toContain('0 stat axes');
    await unmount();
  });

  it('links each card to its pack page', async () => {
    const { container, unmount } = await renderAt('/packs');
    await flush();

    expect(container.querySelector('a.pack-card')?.getAttribute('href')).toBe('/pack/pack-1');
    await unmount();
  });

  it('says so when nobody has shared one', async () => {
    mocks.fetchPacks.mockResolvedValue([]);
    const { container, unmount } = await renderAt('/packs');
    await flush();

    expect(container.querySelector('.empty')).not.toBeNull();
    await unmount();
  });

  it('surfaces a failure instead of an endless spinner', async () => {
    mocks.fetchPacks.mockRejectedValue(new Error('Showcase is off.'));
    const { container, unmount } = await renderAt('/packs');
    await flush();

    expect(container.querySelector('.error-text')?.textContent).toContain('Showcase is off.');
    await unmount();
  });
});

describe('the pack page', () => {
  it('lists the whole structure the pack carries', async () => {
    const { container, unmount } = await renderAt('/pack/pack-1');
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Alignment');
    expect(text).toContain('Where they stand when nobody is watching.');
    expect(text).toContain('Danger');
    expect(text).toContain('Strength');
    expect(text).toContain('Undead');
    await unmount();
  });

  /** Fields belong to an entity; a flat list would lose which one they extend. */
  it('groups fields under the entity they extend', async () => {
    const { container, unmount } = await renderAt('/pack/pack-1');
    await flush();

    const headings = [...container.querySelectorAll('.pack-group h4')].map((h) => h.textContent);
    expect(headings).toEqual(['Characters', 'Locations']);
    await unmount();
  });

  /** The default ladder is shared by every axis without one, so it is stated once. */
  it('separates the default ladder from an axis own ladder', async () => {
    const { container, unmount } = await renderAt('/pack/pack-1');
    await flush();

    expect(container.querySelector('.pack-stat-list')?.textContent).toContain('Titanic');
    expect(container.querySelector('.pack-ladder.shared')?.textContent).toContain('Feeble');
    await unmount();
  });

  it('names a suggestion catalogue after its field rather than its key', async () => {
    const { container, unmount } = await renderAt('/pack/pack-1');
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Alignment');
    expect(text).not.toContain('custom:field-1');
    await unmount();
  });

  /**
   * A catalogue whose field is not in this pack is shown as it is. Hiding it would make the page
   * disagree with the payload, and the raw key is the honest thing to show.
   */
  it('keeps the raw key of a catalogue whose field the pack does not carry', async () => {
    const { container, unmount } = await renderAt('/pack/pack-1');
    await flush();

    expect(container.textContent).toContain('custom:gone');
    await unmount();
  });

  /** A pack applies inside the app; a file saved from a browser has nowhere to go. */
  it('offers no download', async () => {
    const { container, unmount } = await renderAt('/pack/pack-1');
    await flush();

    expect(container.querySelector('.download-button')).toBeNull();
    expect(container.querySelector('.pack-howto')).not.toBeNull();
    await unmount();
  });

  it('credits the pack author and the sharing account separately', async () => {
    const { container, unmount } = await renderAt('/packs');
    await flush();

    const foot = container.querySelector('.pack-card-foot')?.textContent ?? '';
    expect(foot).toContain('Ana the GM');
    expect(foot).toContain('shared by ana#1234');
    await unmount();
  });

  it('falls back to the sharing account when no author is declared', async () => {
    mocks.fetchPacks.mockResolvedValue([{ ...card, authorName: null }]);
    const { container, unmount } = await renderAt('/packs');
    await flush();

    const foot = container.querySelector('.pack-card-foot')?.textContent ?? '';
    expect(foot).toContain('ana');
    expect(foot).not.toContain('shared by');
    await unmount();
  });

  it('surfaces a failure instead of an endless spinner', async () => {
    mocks.fetchPack.mockRejectedValue(new Error('Not found.'));
    const { container, unmount } = await renderAt('/pack/pack-1');
    await flush();

    expect(container.querySelector('.error-text')?.textContent).toContain('Not found.');
    await unmount();
  });
});

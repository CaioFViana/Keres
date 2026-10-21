import type { ShowcaseSearchQuery, ShowcaseStoryCard } from '@keres/shared';
import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '@/services/showcase/showcaseCatalog';
import { authorsOf, facetsOf, foldText, searchCatalog } from '@/services/showcase/showcaseSearch';

function entry(
  title: string,
  over: Partial<ShowcaseStoryCard['snapshot']> = {},
  extra: Partial<CatalogEntry> = {},
): CatalogEntry {
  return {
    ownerUserId: 'owner-1',
    mediums: new Set(),
    workTitles: [],
    card: {
      storyId: title,
      isNsfw: false,
      owner: { username: 'ana', tag: 'ana', avatarColor: null, avatarIcon: null },
      snapshot: {
        title,
        description: null,
        genre: null,
        language: null,
        author: null,
        type: 'linear',
        theme: null,
        ...over,
      },
      versionCount: 1,
      latestVersion: {} as ShowcaseStoryCard['latestVersion'],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    ...extra,
  };
}

const ask = (over: Partial<ShowcaseSearchQuery> = {}): ShowcaseSearchQuery => ({
  sort: 'recent',
  offset: 0,
  ...over,
});

describe('foldText', () => {
  it('lowers case, drops accents and squeezes spaces', () => {
    expect(foldText('  Ação   DRAMÁTICA ')).toBe('acao dramatica');
    expect(foldText(null)).toBe('');
  });
});

describe('searchCatalog', () => {
  const catalog = [entry('Ação'), entry('Brisa', { genre: 'Romance' }), entry('Calor')];

  it('keeps the catalog order for recent and sorts the others without touching it', () => {
    expect(searchCatalog(catalog, ask()).items.map((item) => item.card.storyId)).toEqual([
      'Ação',
      'Brisa',
      'Calor',
    ]);
    const reversed = [...catalog].reverse();
    expect(
      searchCatalog(reversed, ask({ sort: 'title' })).items.map((item) => item.card.storyId),
    ).toEqual(['Ação', 'Brisa', 'Calor']);
    expect(reversed[0].card.storyId).toBe('Calor');
  });

  it('matches an accented title from an unaccented word', () => {
    expect(searchCatalog(catalog, ask({ q: 'acao' })).total).toBe(1);
  });

  it('does not cut the page when no limit is given, and reports the full total when it does', () => {
    expect(searchCatalog(catalog, ask({ offset: 2 })).items).toHaveLength(3);
    const page = searchCatalog(catalog, ask({ limit: 1, offset: 2 }));
    expect(page.items.map((item) => item.card.storyId)).toEqual(['Calor']);
    expect(page.total).toBe(3);
  });
});

describe('facetsOf', () => {
  it('shows the spelling most authors used when two differ by case or accent', () => {
    const catalog = [
      entry('1', { genre: 'fantasía' }),
      entry('2', { genre: 'Fantasia' }),
      entry('3', { genre: 'Fantasia' }),
    ];
    expect(facetsOf(catalog).genres).toEqual([{ value: 'Fantasia', count: 3 }]);
  });
});

describe('authorsOf', () => {
  it('groups by account, counts, and orders by the latest activity', () => {
    const other = entry('Z', {}, { ownerUserId: 'owner-2' });
    other.card.owner = { ...other.card.owner, username: 'bia', tag: 'bia' };
    other.card.updatedAt = '2026-05-01T00:00:00.000Z';
    const { items, total } = authorsOf([entry('A'), entry('B'), other], { offset: 0 });
    expect(total).toBe(2);
    expect(items.map((author) => [author.owner.username, author.storyCount])).toEqual([
      ['bia', 1],
      ['ana', 2],
    ]);
  });
});

import {
  hasActiveShowcaseFilters,
  NO_SHOWCASE_FILTERS,
  SHOWCASE_PAGE_SIZE,
  storyQueryOf,
} from '@/src/utils/format/showcaseFilters';

describe('showcase filters', () => {
  it('start with nothing set, newest first', () => {
    expect(NO_SHOWCASE_FILTERS).toEqual({
      q: '',
      genre: null,
      language: null,
      type: null,
      medium: null,
      sort: 'recent',
    });
    expect(hasActiveShowcaseFilters(NO_SHOWCASE_FILTERS)).toBe(false);
  });

  it('count any narrowing as active, and the order as nothing', () => {
    expect(hasActiveShowcaseFilters({ ...NO_SHOWCASE_FILTERS, sort: 'title' })).toBe(false);
    expect(hasActiveShowcaseFilters({ ...NO_SHOWCASE_FILTERS, q: '   ' })).toBe(false);
    for (const patch of [
      { q: 'casa' },
      { genre: 'Fantasy' },
      { language: 'en' },
      { type: 'linear' as const },
      { medium: 'comic' as const },
    ]) {
      expect(hasActiveShowcaseFilters({ ...NO_SHOWCASE_FILTERS, ...patch })).toBe(true);
    }
  });

  it('make the query of a page, with only what is set', () => {
    expect(storyQueryOf(NO_SHOWCASE_FILTERS, 0)).toEqual({
      q: undefined,
      genre: undefined,
      language: undefined,
      type: undefined,
      medium: undefined,
      sort: 'recent',
      limit: SHOWCASE_PAGE_SIZE,
      offset: 0,
    });
    expect(
      storyQueryOf(
        {
          q: ' casa ',
          genre: 'Fantasy',
          language: 'en',
          type: 'branching',
          medium: 'comic',
          sort: 'author',
        },
        48,
        10,
      ),
    ).toEqual({
      q: 'casa',
      genre: 'Fantasy',
      language: 'en',
      type: 'branching',
      medium: 'comic',
      sort: 'author',
      limit: 10,
      offset: 48,
    });
  });
});

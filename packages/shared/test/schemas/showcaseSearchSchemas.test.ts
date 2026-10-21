import { describe, expect, it } from 'vitest';
import {
  genreList,
  SHOWCASE_PAGE_MAX,
  ShowcaseAuthorQuerySchema,
  ShowcaseSearchQuerySchema,
} from '../../index';

describe('ShowcaseSearchQuerySchema', () => {
  it('asks for the whole list, newest first, when nothing is given', () => {
    expect(ShowcaseSearchQuerySchema.parse({})).toEqual({ sort: 'recent', offset: 0 });
  });

  it('reads the numbers a URL carries as strings and trims the text', () => {
    expect(
      ShowcaseSearchQuerySchema.parse({
        q: '  dragon ',
        limit: '24',
        offset: '48',
        medium: 'comic',
      }),
    ).toMatchObject({ q: 'dragon', limit: 24, offset: 48, medium: 'comic' });
  });

  it.each([
    { sort: 'sideways' },
    { type: 'epic' },
    { medium: 'poem' },
    { limit: '0' },
    { limit: String(SHOWCASE_PAGE_MAX + 1) },
    { offset: '-1' },
    { q: 'x'.repeat(101) },
  ])('refuses %j', (query) => {
    expect(ShowcaseSearchQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('ShowcaseAuthorQuerySchema', () => {
  it('takes a name, a page and nothing else', () => {
    expect(ShowcaseAuthorQuerySchema.parse({ q: 'ana', limit: '10' })).toEqual({
      q: 'ana',
      limit: 10,
      offset: 0,
    });
  });
});

describe('genreList', () => {
  it('splits on comma, slash and semicolon and drops the empty parts', () => {
    expect(genreList('Fantasy,, / Mystery;Horror')).toEqual(['Fantasy', 'Mystery', 'Horror']);
    expect(genreList(null)).toEqual([]);
    expect(genreList('')).toEqual([]);
  });
});

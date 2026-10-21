import { describe, expect, it } from 'vitest';
import {
  filtersFromParams,
  hasActiveFilters,
  listQuery,
  NO_FILTERS,
  paramsFromFilters,
} from '@/showcase/storyFilters';

describe('the filters of the address', () => {
  it('reads an empty address as "everything, newest first"', () => {
    expect(filtersFromParams(new URLSearchParams())).toEqual(NO_FILTERS);
  });

  it('round-trips through the address and writes only what differs from the default', () => {
    const filters = { ...NO_FILTERS, q: 'vale', genre: 'Fantasia', sort: 'author' as const };
    const params = paramsFromFilters(filters);
    expect(params.toString()).toBe('q=vale&genre=Fantasia&sort=author');
    expect(filtersFromParams(params)).toEqual(filters);
    expect(paramsFromFilters(NO_FILTERS).toString()).toBe('');
  });

  it('falls back to the default order for one this build does not know', () => {
    expect(filtersFromParams(new URLSearchParams('sort=sideways')).sort).toBe('recent');
  });

  it('trims what it writes, and counts text as a filter but not the order', () => {
    expect(paramsFromFilters({ ...NO_FILTERS, q: '  vale ' }).get('q')).toBe('vale');
    expect(hasActiveFilters({ ...NO_FILTERS, sort: 'title' })).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, q: ' ' })).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, medium: 'comic' })).toBe(true);
  });

  it('adds the page size to the query of the list', () => {
    expect(listQuery(NO_FILTERS, 24)).toBe('limit=24');
    expect(listQuery({ ...NO_FILTERS, type: 'branching' })).toBe('type=branching');
  });
});

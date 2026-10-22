import { DEFAULT_SHOWCASE_SORT, SHOWCASE_SORTS } from '@keres/shared/metadata/ShowcaseSort';
import type { ShowcaseSort } from '@keres/shared';

/**
 * What the home page asks the list for. Kept as plain strings (an empty one is "no filter") because that is
 * what a form control and a URL both hold; the address bar is the source of truth, so a search can be shared.
 */
export interface StoryFilters {
  q: string;
  genre: string;
  language: string;
  type: string;
  medium: string;
  sort: ShowcaseSort;
}

export const NO_FILTERS: StoryFilters = {
  q: '',
  genre: '',
  language: '',
  type: '',
  medium: '',
  sort: DEFAULT_SHOWCASE_SORT,
};

const FILTER_KEYS = ['q', 'genre', 'language', 'type', 'medium'] as const;

/** The filters an address carries; a sort this build does not know is the default one. */
export function filtersFromParams(params: URLSearchParams): StoryFilters {
  const sort = params.get('sort');
  return {
    q: params.get('q') ?? '',
    genre: params.get('genre') ?? '',
    language: params.get('language') ?? '',
    type: params.get('type') ?? '',
    medium: params.get('medium') ?? '',
    sort: (SHOWCASE_SORTS as readonly string[]).includes(sort ?? '')
      ? (sort as ShowcaseSort)
      : NO_FILTERS.sort,
  };
}

/** Only what differs from "show everything, newest first", so an unfiltered home stays a clean address. */
export function paramsFromFilters(filters: StoryFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key].trim();
    if (value) params.set(key, value);
  }
  if (filters.sort !== NO_FILTERS.sort) params.set('sort', filters.sort);
  return params;
}

/** Whether anything narrows the list (the sort alone does not: it reorders, it hides nothing). */
export function hasActiveFilters(filters: StoryFilters): boolean {
  return FILTER_KEYS.some((key) => filters[key].trim() !== '');
}

/** The query string of `GET /api/public/stories` for these filters and the first `limit` stories. */
export function listQuery(filters: StoryFilters, limit?: number): string {
  const params = paramsFromFilters(filters);
  if (limit !== undefined) params.set('limit', String(limit));
  return params.toString();
}

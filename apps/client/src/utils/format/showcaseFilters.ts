import type { ArcMedium, ShowcaseSearchQuery, ShowcaseSort } from '@keres/shared';
import { DEFAULT_SHOWCASE_SORT } from '@keres/shared';

/** How many stories or authors one page of the lists asks for. */
export const SHOWCASE_PAGE_SIZE = 24;

/** What the story list is narrowed by; the filters add up. */
export interface ShowcaseFilters {
  q: string;
  genre: string | null;
  language: string | null;
  type: 'linear' | 'branching' | null;
  medium: ArcMedium | null;
  sort: ShowcaseSort;
}

export const NO_SHOWCASE_FILTERS: ShowcaseFilters = {
  q: '',
  genre: null,
  language: null,
  type: null,
  medium: null,
  sort: DEFAULT_SHOWCASE_SORT,
};

/** Whether anything narrows the list (the order does not: it only arranges what is there). */
export function hasActiveShowcaseFilters(filters: ShowcaseFilters): boolean {
  return !!(
    filters.q.trim() ||
    filters.genre ||
    filters.language ||
    filters.type ||
    filters.medium
  );
}

/** The query of one page of the story list. */
export function storyQueryOf(
  filters: ShowcaseFilters,
  offset: number,
  limit: number = SHOWCASE_PAGE_SIZE,
): Partial<ShowcaseSearchQuery> {
  return {
    q: filters.q.trim() || undefined,
    genre: filters.genre ?? undefined,
    language: filters.language ?? undefined,
    type: filters.type ?? undefined,
    medium: filters.medium ?? undefined,
    sort: filters.sort,
    limit,
    offset,
  };
}

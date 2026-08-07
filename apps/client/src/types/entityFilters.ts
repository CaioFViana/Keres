/**
 * Canonical filter/sort types shared by the story entity services and their stores.
 *
 * These were previously re-declared in a dozen places (nine services plus several
 * stores), which meant a change to the contract had to be made a dozen times and
 * structurally-identical types were nominally unrelated. Every declaration site now
 * re-exports from here, so existing imports keep working unchanged.
 */

export type FavoriteFilterState = 'all' | 'favorite' | 'not-favorite';

export type SortDirection = 'asc' | 'desc';

export type AdvancedSearchCriteria = { [key: string]: any };

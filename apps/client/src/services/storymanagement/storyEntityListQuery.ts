import { asc, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { columnsOf } from '../entityTableRegistry';
import type { FavoriteFilterState, SortDirection } from '../../types/entityFilters';

/**
 * The list queries of the story entity services share a shape: scope to one story, drop the
 * soft-deleted rows, match a search term, filter by favourite, then sort. These helpers hold the
 * pieces that are the same everywhere. Entity-specific filters (tags, arcs, extra columns, the
 * advanced-search fallbacks) stay in each service and are pushed after these predicates; the
 * predicates are ANDed, so the order does not change which rows match.
 */

/** A story-scoped synced table. `isFavorite` is only needed when a favourite filter is applied. */
export type StoryEntityTable = SQLiteTable & {
  storyId: SQLiteColumn;
  isDeleted: SQLiteColumn;
  createdAt: SQLiteColumn;
  isFavorite?: SQLiteColumn;
};

export interface StoryEntityConditionOptions {
  /** The column(s) the search term is matched against; with several, a row matches if any does. */
  searchColumn: SQLiteColumn | SQLiteColumn[];
  searchTerm?: string;
  favoriteFilterState?: FavoriteFilterState;
}

/** Case-insensitive "contains" over one text column, the form every story list searches with. */
export function containsIgnoreCase(column: SQLiteColumn, term: string): SQL<boolean> {
  return sql`${column} LIKE ${`%${term}%`} COLLATE NOCASE` as SQL<boolean>;
}

/**
 * The predicates every story-scoped list starts with: the story, the live rows, the search term and
 * the favourite filter. The caller pushes its own predicates after these.
 */
export function storyEntityConditions(
  table: StoryEntityTable,
  storyId: string,
  options: StoryEntityConditionOptions,
): SQL<boolean>[] {
  const conditions: SQL<boolean>[] = [
    eq(table.storyId, storyId) as SQL<boolean>,
    eq(table.isDeleted, false) as SQL<boolean>,
  ];

  const { searchColumn, searchTerm, favoriteFilterState } = options;
  if (searchTerm) {
    conditions.push(
      Array.isArray(searchColumn)
        ? (or(
            ...searchColumn.map((column) => containsIgnoreCase(column, searchTerm)),
          ) as SQL<boolean>)
        : containsIgnoreCase(searchColumn, searchTerm),
    );
  }

  // The favourite filter only ever arrives in the singular form; 'all' adds no predicate.
  if (favoriteFilterState === 'favorite' || favoriteFilterState === 'not-favorite') {
    if (!table.isFavorite) {
      throw new Error('storyEntityConditions: the table has no isFavorite column');
    }
    conditions.push(eq(table.isFavorite, favoriteFilterState === 'favorite') as SQL<boolean>);
  }

  return conditions;
}

/** The one method of a dynamic select the sort helpers need; it returns the same query type. */
export interface OrderableSelect<TQuery> {
  orderBy(...columns: (SQLiteColumn | SQL)[]): TQuery;
}

/**
 * Sorts by any column of the table, named by `sortBy`. Without a name the rows are ordered by
 * creation time; an unknown name is warned about and the query is left unsorted.
 */
export function applyListSort<TQuery extends OrderableSelect<TQuery>>(
  query: TQuery,
  table: StoryEntityTable,
  sortBy: string | null | undefined,
  sortDirection: SortDirection | undefined,
): TQuery {
  if (!sortBy) {
    return query.orderBy(asc(table.createdAt));
  }
  // The sort key comes from outside, so the column is checked: a name the table lacks reads as undefined.
  const column: SQLiteColumn | undefined = columnsOf(table)[sortBy];
  if (!column) {
    console.warn(`Unknown sortBy field: ${sortBy}`);
    return query;
  }
  const orderBy = sortDirection === 'desc' ? desc : asc;
  return query.orderBy(orderBy(column));
}

/**
 * Sorts by one of a fixed set of named columns, so only the listed names can be sorted by. Without a
 * name the rows are ordered by `defaultColumn`, ascending. `leadingOrder` goes ahead of whatever
 * order is applied, and is not applied when the name is unknown (which is warned about and left
 * unsorted).
 */
export function applyKeyedListSort<TQuery extends OrderableSelect<TQuery>>(
  query: TQuery,
  sortBy: string | null | undefined,
  sortDirection: SortDirection | undefined,
  sortColumns: Record<string, SQLiteColumn>,
  defaultColumn: SQLiteColumn,
  leadingOrder: (SQLiteColumn | SQL)[] = [],
): TQuery {
  if (!sortBy) {
    return query.orderBy(...leadingOrder, asc(defaultColumn));
  }
  const column = Object.prototype.hasOwnProperty.call(sortColumns, sortBy)
    ? sortColumns[sortBy]
    : undefined;
  if (!column) {
    console.warn(`Unknown sortBy field: ${sortBy}`);
    return query;
  }
  const orderBy = sortDirection === 'desc' ? desc : asc;
  return query.orderBy(...leadingOrder, orderBy(column));
}

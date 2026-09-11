import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type { EntityStoreCore } from '../state/createEntityStore';
import { useStoryStore } from '../state/storyStore';
import type { FavoriteFilterState, SortDirection } from '../types/entityFilters';
import { debounce } from '../utils/debounce';
import { useEntityEventSubscriptions } from './useEntityRefreshLifecycle';

/**
 * Any store produced by `createEntityStore`. Kept structural rather than referencing
 * `EntityStore<TKey, TEntity, TService>` directly so TypeScript can infer the entity type
 * from the collection property - it cannot infer through a mapped type's value position.
 */
type AnyEntityStore = EntityStoreCore<unknown> & Record<string, any>;

export interface UseEntityListScreenOptions<
  TStore extends AnyEntityStore,
  TKey extends keyof TStore & string,
> {
  /** The entity's Zustand store, as built by `createEntityStore`. */
  useStore: () => TStore;
  collectionKey: TKey;
  /** Emitted when the entity changes anywhere in the app; triggers a refetch. */
  changeEvent: string;
  /** How long to wait after typing stops before querying. */
  searchDebounceMs?: number;
}

/** Filter/search/sort props that `GenericFilterSortList` receives via `{...listProps}`. */
export type EntityListFilterProps = {
  onSearch: (searchText: string) => void;
  onSearchSubmit: () => void;
  currentSearchTerm: string;
  onFilterChange: (filterValues: string[]) => void;
  selectedFilterValues: string[];
  onSortChange: (sortValue: string | null) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
  currentSortDirection: SortDirection;
  currentSortValue: string | null;
  onFavoriteFilterChange: (state: FavoriteFilterState) => void;
  currentFavoriteFilterState: FavoriteFilterState;
  onAdvancedSearch: (criteria: { [key: string]: any }) => void;
  currentAdvancedSearchCriteria: { [key: string]: any };
  isLoading: boolean;
};

/**
 * The wiring every entity list screen repeats.
 *
 * Each list screen bootstrapped the store with db + storyId, mirrored the store's search
 * term into local state so typing stays responsive, debounced it back, refetched whenever
 * a filter changed, and subscribed to the entity's change event - the same ~60 lines with
 * a noun swapped.
 *
 * Search is deliberately two-tiered: `searchQuery` updates on every keystroke so the input
 * never lags, while the store's term (and therefore the query) only follows once typing
 * pauses.
 */
export function useEntityListScreen<
  TStore extends AnyEntityStore,
  TKey extends keyof TStore & string,
>({
  useStore,
  collectionKey,
  changeEvent,
  searchDebounceMs = 1000,
}: UseEntityListScreenOptions<TStore, TKey>) {
  const store = useStore();
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;

  const {
    searchTerm: storeSearchTerm,
    activeFilterTags,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria,
    loading,
    error,
    setSearchTerm: setStoreSearchTerm,
    setDbAndStoryId,
    initializeService,
    setSort,
    setFilterTags,
    setFavoriteFilter,
    setAdvancedSearchCriteria,
    toggleFavorite,
  } = store;

  const items = store[collectionKey] as TStore[TKey];
  const fetchKey = `fetch${collectionKey.charAt(0).toUpperCase()}${collectionKey.slice(1)}`;
  const fetchItems = store[fetchKey] as () => Promise<void>;

  const [searchQuery, setSearchQuery] = useState(storeSearchTerm);
  // Keep the list shell mounted after its first response for a story. A filter can quite
  // legitimately return no rows; replacing the whole screen with a loading state at that
  // point would also unmount open filter controls (including MultiSelectPill's modal).
  const [loadedStoryId, setLoadedStoryId] = useState<string | null>(null);

  const debouncedSetStoreSearchTerm = useMemo(
    () => debounce((term: string) => setStoreSearchTerm(term), searchDebounceMs),
    [setStoreSearchTerm, searchDebounceMs],
  );

  useEffect(() => {
    debouncedSetStoreSearchTerm(searchQuery);
    return () => {
      debouncedSetStoreSearchTerm.cancel?.();
    };
  }, [searchQuery, debouncedSetStoreSearchTerm]);

  /** Commits the pending search immediately, skipping the debounce wait - for Enter/submit. */
  const handleSearchSubmit = useCallback(() => {
    debouncedSetStoreSearchTerm.cancel?.();
    setStoreSearchTerm(searchQuery);
  }, [debouncedSetStoreSearchTerm, setStoreSearchTerm, searchQuery]);

  useEffect(() => {
    if (drizzleDb && storyId) {
      setDbAndStoryId(drizzleDb, storyId);
      initializeService();
    }
  }, [drizzleDb, storyId, setDbAndStoryId, initializeService]);

  // Refetch whenever the committed filter state or the open story changes. `fetchItems`
  // is a stable store method, so without `storyId` here a story switch would keep the
  // previous story's rows on screen until the user touched a filter.
  useEffect(() => {
    let cancelled = false;

    void fetchItems().finally(() => {
      if (!cancelled) setLoadedStoryId(storyId ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [
    storyId,
    storeSearchTerm,
    activeFilterTags,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria,
    fetchItems,
  ]);

  const isInitialLoading = !!storyId && loadedStoryId !== storyId;

  const handleEntityChange = useCallback(
    (changedStoryId: string) => {
      if (changedStoryId === storyId) fetchItems();
    },
    [fetchItems, storyId],
  );
  useEntityEventSubscriptions(
    useMemo(
      () => [{ event: changeEvent, listener: handleEntityChange }],
      [changeEvent, handleEntityChange],
    ),
  );

  const handleSortChange = useCallback(
    (sortBy: string | null) => setSort(sortBy, sortDirection),
    [setSort, sortDirection],
  );
  const handleSortDirectionChange = useCallback(
    (direction: SortDirection) => setSort(activeSort, direction),
    [activeSort, setSort],
  );

  // Spread into GenericFilterSortList; content, available filters and row rendering stay local.
  const listProps: EntityListFilterProps = useMemo(
    () => ({
      onSearch: setSearchQuery,
      onSearchSubmit: handleSearchSubmit,
      currentSearchTerm: searchQuery,
      onFilterChange: setFilterTags,
      selectedFilterValues: activeFilterTags,
      onSortChange: handleSortChange,
      onSortDirectionChange: handleSortDirectionChange,
      currentSortDirection: sortDirection,
      currentSortValue: activeSort,
      onFavoriteFilterChange: setFavoriteFilter,
      currentFavoriteFilterState: favoriteFilterState,
      onAdvancedSearch: setAdvancedSearchCriteria,
      currentAdvancedSearchCriteria: advancedSearchCriteria,
      isLoading: loading,
    }),
    [
      activeFilterTags,
      activeSort,
      advancedSearchCriteria,
      favoriteFilterState,
      handleSearchSubmit,
      handleSortChange,
      handleSortDirectionChange,
      loading,
      searchQuery,
      setAdvancedSearchCriteria,
      setFavoriteFilter,
      setFilterTags,
      sortDirection,
    ],
  );

  return {
    listProps,
    items,
    loading,
    /** True only until this screen has received its first response for the selected story. */
    isInitialLoading,
    error,
    storyId,
    /** Local, updates per keystroke - bind this to the search input. */
    searchQuery,
    activeFilterTags,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria,

    handleSearch: setSearchQuery,
    handleSearchSubmit,
    handleSortChange,
    handleSortDirectionChange,
    handleFilterTagsChange: setFilterTags,
    handleFavoriteFilterChange: setFavoriteFilter,
    setAdvancedSearchCriteria,
    toggleFavorite,
    refetch: fetchItems,
  };
}

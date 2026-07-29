import { useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import { EntityStoreCore } from '../state/createEntityStore';
import { useStoryStore } from '../state/storyStore';
import { SortDirection } from '../types/entityFilters';
import { debounce } from '../utils/debounce';
import { entityEventEmitter } from '../utils/EventEmitter';

/**
 * Any store produced by `createEntityStore`. Kept structural rather than referencing
 * `EntityStore<TKey, TEntity, TService>` directly so TypeScript can infer the entity type
 * from the collection property - it cannot infer through a mapped type's value position.
 */
type AnyEntityStore = EntityStoreCore<unknown> & Record<string, any>;

export interface UseEntityListScreenOptions<TStore extends AnyEntityStore, TKey extends keyof TStore & string> {
  /** The entity's Zustand store, as built by `createEntityStore`. */
  useStore: () => TStore;
  collectionKey: TKey;
  /** Emitted when the entity changes anywhere in the app; triggers a refetch. */
  changeEvent: string;
  /** How long to wait after typing stops before querying. */
  searchDebounceMs?: number;
}

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
export function useEntityListScreen<TStore extends AnyEntityStore, TKey extends keyof TStore & string>({
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

  useEffect(() => {
    if (drizzleDb && storyId) {
      setDbAndStoryId(drizzleDb, storyId);
      initializeService();
    }
  }, [drizzleDb, storyId, setDbAndStoryId, initializeService]);

  // Refetch whenever the committed filter state changes.
  useEffect(() => {
    fetchItems();
  }, [storeSearchTerm, activeFilterTags, activeSort, sortDirection, favoriteFilterState, advancedSearchCriteria, fetchItems]);

  useEffect(() => {
    const handleChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) {
        fetchItems();
      }
    };
    entityEventEmitter.on(changeEvent, handleChange);
    return () => {
      entityEventEmitter.off(changeEvent, handleChange);
    };
  }, [changeEvent, storyId, fetchItems]);

  return {
    items,
    loading,
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
    handleSortChange: (sortBy: string | null) => setSort(sortBy, sortDirection),
    handleSortDirectionChange: (direction: SortDirection) => setSort(activeSort, direction),
    handleFilterTagsChange: setFilterTags,
    handleFavoriteFilterChange: setFavoriteFilter,
    setAdvancedSearchCriteria,
    toggleFavorite,
    refetch: fetchItems,
  };
}

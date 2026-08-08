import AsyncStorage from '@react-native-async-storage/async-storage';
import { create, StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AppDrizzleClient } from '../db';
import { AdvancedSearchCriteria, FavoriteFilterState, SortDirection } from '../types/entityFilters';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useUserSettingsStore } from './userSettingsStore';
import { FavoriteEntityType } from '@keres/shared';
import { createFavoriteService } from '../services/storymanagement/FavoriteService';

/** The filter/sort state a fetch is run against. */
export interface EntityQueryParams {
  storyId: string;
  searchTerm: string;
  activeFilterTags: string[];
  favoriteFilterState: FavoriteFilterState;
  activeSort: string | null;
  sortDirection: SortDirection;
  advancedSearchCriteria: AdvancedSearchCriteria;
}

/** State and actions every story-entity list store shares. */
export interface EntityStoreCore<TService> {
  db: AppDrizzleClient | null;
  storyId: string | null;
  service: TService | null;
  loading: boolean;
  error: string | null;
  searchTerm: string;
  activeFilterTags: string[];
  favoriteFilterState: FavoriteFilterState;
  activeSort: string | null;
  sortDirection: SortDirection;
  advancedSearchCriteria: AdvancedSearchCriteria;

  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  setSearchTerm: (term: string) => void;
  setFilterTags: (tagIds: string[]) => void;
  setFavoriteFilter: (state: FavoriteFilterState) => void;
  setSort: (sortBy: string | null, direction: SortDirection) => void;
  setAdvancedSearchCriteria: (criteria: AdvancedSearchCriteria) => void;
  toggleFavorite: (id: string, isFavorite: boolean) => Promise<void>;
  resetStore: () => void;
}

/** `tags: TagSelect[]` — the collection under the store's own name. */
type CollectionSlice<TKey extends string, TEntity> = { [P in TKey]: TEntity[] };

/** `fetchTags: () => Promise<void>` — the fetch action under the store's own name. */
type FetchSlice<TKey extends string> = {
  [P in `fetch${Capitalize<TKey>}`]: () => Promise<void>;
};

export type EntityStore<TKey extends string, TEntity, TService> =
  EntityStoreCore<TService> & CollectionSlice<TKey, TEntity> & FetchSlice<TKey>;

export interface EntityStoreConfig<TKey extends string, TEntity, TService> {
  /** Plural collection name, e.g. `'tags'`. Drives the public keys: `tags` / `fetchTags`. */
  collectionKey: TKey;
  favoriteEntityType?: FavoriteEntityType;
  createService: (db: AppDrizzleClient) => TService;
  /** Maps the shared query params onto this service's own fetch signature. */
  fetchEntities: (service: TService, params: EntityQueryParams) => Promise<TEntity[]>;
  /** Persists a favourite toggle. Omit for entities that have no favourite flag. */
  updateFavorite?: (service: TService, userId: string, id: string, isFavorite: boolean) => Promise<unknown>;
  /** Emitted after a successful favourite toggle so open screens refresh. */
  changeEvent?: string;
  defaultSort?: string | null;
  defaultSortDirection?: SortDirection;
  /**
   * Whether `setSearchTerm` refetches immediately.
   *
   * List screens debounce typing locally and drive the fetch from an effect watching
   * the store's term, so refetching here too fires the query twice per keystroke-burst.
   * Defaults to false; the stores that currently do it opt in explicitly.
   */
  fetchOnSearchTermChange?: boolean;
  errorMessages?: { fetch?: string; toggleFavorite?: string };
  /** Persists the filter/sort selection under this key, via AsyncStorage. */
  persistKey?: string;
  /** Store-specific actions (reordering, etc.) that the shared core doesn't cover. */
  extraActions?: (helpers: EntityStoreHelpers<TKey, TEntity, TService>) => object;
}

export interface EntityStoreHelpers<TKey extends string, TEntity, TService> {
  get: () => EntityStore<TKey, TEntity, TService>;
  setPartial: (partial: Record<string, unknown>) => void;
  /** Re-runs the configured fetch with the current filter state. */
  refetch: () => Promise<void>;
}

const capitalize = <T extends string>(value: T) =>
  (value.charAt(0).toUpperCase() + value.slice(1)) as Capitalize<T>;

/**
 * Builds a Zustand store for a story-entity list screen.
 *
 * The eleven entity stores were the same ~140 lines with a noun swapped: the same
 * filter/sort state, the same service bootstrapping, the same fetch-and-set cycle, the
 * same optimistic favourite toggle. Only the service call signatures genuinely differed,
 * so those stay per-store as `fetchEntities` / `updateFavorite` callbacks.
 *
 * The public keys stay entity-named (`tags`, `fetchTags`) so screens consuming these
 * stores need no changes.
 */
export function createEntityStore<
  TKey extends string,
  TEntity extends { id: string },
  TService,
  TExtra extends object = object,
>(config: EntityStoreConfig<TKey, TEntity, TService>) {
  type Store = EntityStore<TKey, TEntity, TService> & TExtra;

  const { collectionKey } = config;
  const fetchKey = `fetch${capitalize(collectionKey)}`;
  const label = collectionKey;

  const defaultState = {
    [collectionKey]: [] as TEntity[],
    db: null,
    storyId: null,
    service: null,
    loading: false,
    error: null,
    searchTerm: '',
    activeFilterTags: [] as string[],
    favoriteFilterState: 'all' as FavoriteFilterState,
    activeSort: config.defaultSort ?? null,
    sortDirection: config.defaultSortDirection ?? 'asc',
    advancedSearchCriteria: {} as AdvancedSearchCriteria,
  };

  const creator: StateCreator<Store> = (set, get) => {
    const setPartial = (partial: Record<string, unknown>) => set(partial as Partial<Store>);

    const runFetch = async (): Promise<void> => {
      const state = get() as Store;
      const { service, storyId } = state;

      if (!service || !storyId) {
        setPartial({ [collectionKey]: [], loading: false });
        return;
      }

      setPartial({ loading: true, error: null });
      try {
        const localUserId = useUserSettingsStore.getState().userId;
        const favoriteService = state.db ? createFavoriteService(state.db) : null;
        const individualFavorites = !!(
          config.favoriteEntityType && localUserId && favoriteService
          && await favoriteService.getBehavior(storyId) !== 'global'
        );
        let entities = await config.fetchEntities(service, {
          storyId,
          searchTerm: state.searchTerm,
          activeFilterTags: state.activeFilterTags,
          favoriteFilterState: individualFavorites ? 'all' : state.favoriteFilterState,
          activeSort: state.activeSort,
          sortDirection: state.sortDirection,
          advancedSearchCriteria: state.advancedSearchCriteria,
        });
        if (individualFavorites && favoriteService && localUserId && config.favoriteEntityType) {
          entities = await favoriteService.decorateEntities(
            storyId,
            config.favoriteEntityType,
            localUserId,
            entities as (TEntity & { isFavorite: boolean })[],
          ) as TEntity[];
          if (state.favoriteFilterState !== 'all') {
            const expected = state.favoriteFilterState === 'favorite';
            entities = entities.filter((entity) => (entity as TEntity & { isFavorite: boolean }).isFavorite === expected);
          }
        }
        setPartial({ [collectionKey]: entities, loading: false });
      } catch (err) {
        console.error(`Failed to fetch ${label}:`, err);
        setPartial({
          error: config.errorMessages?.fetch ?? `Failed to load ${label}.`,
          loading: false,
        });
      }
    };

    /** Applies a change then refetches, the pattern every filter/sort setter follows. */
    const setAndRefetch = (partial: Record<string, unknown>) => {
      setPartial(partial);
      runFetch();
    };

    const toggleFavorite = async (id: string, isFavorite: boolean): Promise<void> => {
      const { service, storyId } = get() as Store;
      if (!service || !storyId) {
        console.warn(`Service or storyId not set; cannot toggle favorite for ${label}.`);
        return;
      }
      if (!config.updateFavorite || !config.favoriteEntityType) {
        console.warn(`No updateFavorite configured for ${label}.`);
        return;
      }

      const userId = useUserSettingsStore.getState().userId;
      if (!userId) {
        console.error(`User ID not available. Cannot toggle favorite for ${label}.`);
        return;
      }

      const previous = (get() as Store)[collectionKey] as TEntity[];

      // Optimistic update, reverted below if the write fails.
      setPartial({
        [collectionKey]: previous.map((entity) =>
          entity.id === id ? { ...entity, isFavorite } : entity
        ),
      });

      try {
        const favoriteService = createFavoriteService((get() as Store).db!);
        if (await favoriteService.getBehavior(storyId) !== 'global') {
          await favoriteService.setFavorite(storyId, id, config.favoriteEntityType, userId, isFavorite);
        } else {
          await config.updateFavorite(service, userId, id, isFavorite);
        }
        if (config.changeEvent) {
          entityEventEmitter.emit(config.changeEvent, storyId);
        }
      } catch (err) {
        console.error(`Failed to toggle favorite for ${label}:`, err);
        setPartial({
          [collectionKey]: previous,
          error: config.errorMessages?.toggleFavorite ?? `Failed to update favorite status.`,
        });
      }
    };

    const core = {
      ...defaultState,
      [fetchKey]: runFetch,

      setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => setPartial({ db, storyId }),

      initializeService: () => {
        const { db, service } = get() as Store;
        if (db && !service) {
          setPartial({ service: config.createService(db) });
        }
      },

      setSearchTerm: (term: string) => {
        if (config.fetchOnSearchTermChange) {
          setAndRefetch({ searchTerm: term });
        } else {
          setPartial({ searchTerm: term });
        }
      },

      setFilterTags: (tagIds: string[]) => setAndRefetch({ activeFilterTags: tagIds }),
      setFavoriteFilter: (state: FavoriteFilterState) => setAndRefetch({ favoriteFilterState: state }),
      setSort: (sortBy: string | null, direction: SortDirection) =>
        setAndRefetch({ activeSort: sortBy, sortDirection: direction }),
      setAdvancedSearchCriteria: (criteria: AdvancedSearchCriteria) =>
        setAndRefetch({ advancedSearchCriteria: criteria }),

      toggleFavorite,

      resetStore: () => setPartial(defaultState),

      ...config.extraActions?.({
        get: () => get() as EntityStore<TKey, TEntity, TService>,
        setPartial,
        refetch: runFetch,
      }),
    };

    return core as unknown as Store;
  };

  if (!config.persistKey) {
    return create<Store>(creator);
  }

  return create<Store>()(
    persist(creator, {
      name: config.persistKey,
      storage: createJSONStorage(() => AsyncStorage),
      // Only the user's filter/sort selection is worth restoring - never the entity
      // rows themselves (they belong to the local DB) nor the live service handle.
      partialize: (state) =>
        ({
          searchTerm: state.searchTerm,
          activeSort: state.activeSort,
          sortDirection: state.sortDirection,
          favoriteFilterState: state.favoriteFilterState,
          advancedSearchCriteria: state.advancedSearchCriteria,
        }) as unknown as Store,
    })
  );
}

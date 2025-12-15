import { create } from 'zustand';
import { AppDrizzleClient, WorldRuleSelect } from '../db';
import { createWorldRuleService, WorldRuleService } from '../services/WorldRuleService';
import { entityEventEmitter } from '../utils/EventEmitter';
import { debounce } from '../utils/debounce';
import { useUserSettingsStore } from './userSettingsStore';

export type FavoriteFilterState = 'all' | 'favorite' | 'not-favorite';

interface WorldRuleStore {
  worldRules: WorldRuleSelect[];
  searchTerm: string;
  activeFilterTags: string[];
  favoriteFilterState: FavoriteFilterState;
  activeSort: string | null;
  sortDirection: 'asc' | 'desc';
  loading: boolean;
  error: string | null;
  db: AppDrizzleClient | null;
  storyId: string | null;
  worldRuleService: WorldRuleService | null;
  advancedSearchCriteria: { [key: string]: any };

  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchWorldRules: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setFilterTags: (tagIds: string[]) => void;
  setFavoriteFilter: (state: FavoriteFilterState) => void;
  setSort: (sortBy: string | null, direction: 'asc' | 'desc') => void;
  toggleFavorite: (worldRuleId: string, isFavorite: boolean) => Promise<void>;
  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => void;
  resetStore: () => void;
}

const defaultState = {
  worldRules: [],
  searchTerm: '',
  activeFilterTags: [],
  favoriteFilterState: 'all' as FavoriteFilterState,
  activeSort: null,
  sortDirection: 'asc' as 'asc' | 'desc',
  loading: false,
  error: null,
  db: null,
  storyId: null,
  worldRuleService: null,
  advancedSearchCriteria: {},
};

export const worldRuleStore = create<WorldRuleStore>((set, get) => ({
  ...defaultState,

  setDbAndStoryId: (db, storyId) => set({ db, storyId }),
  initializeService: () => {
    const { db } = get();
    if (db) {
      set({ worldRuleService: createWorldRuleService(db) });
    }
  },

  fetchWorldRules: debounce(async () => {
    const { worldRuleService, storyId, searchTerm, activeFilterTags, favoriteFilterState, activeSort, sortDirection, advancedSearchCriteria } = get();
    if (!worldRuleService || !storyId) {
      set({ worldRules: [], loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const fetchedWorldRules = await worldRuleService.getWorldRulesByStoryId(
        storyId,
        searchTerm,
        activeFilterTags,
        activeSort,
        sortDirection,
        favoriteFilterState,
        advancedSearchCriteria,
      );
      set({ worldRules: fetchedWorldRules, loading: false });
    } catch (err) {
      console.error('Failed to fetch world rules:', err);
      set({ error: 'Failed to load world rules.', loading: false });
    }
  }, 300),

  setSearchTerm: (term: string) => set({ searchTerm: term }),
  setFilterTags: (tagIds: string[]) => set({ activeFilterTags: tagIds }),
  setFavoriteFilter: (state: FavoriteFilterState) => set({ favoriteFilterState: state }),
  setSort: (sortBy: string | null, direction: 'asc' | 'desc') => set({ activeSort: sortBy, sortDirection: direction }),

  toggleFavorite: async (worldRuleId: string, isFavorite: boolean) => {
    const { worldRuleService, storyId } = get();
    if (!worldRuleService || !storyId) {
      console.warn('WorldRuleService not initialized or storyId not set.');
      return;
    }

    const userId = useUserSettingsStore.getState().userId;
    if (!userId) {
      console.error('User ID not available. Cannot toggle world rule favorite status.');
      return;
    }

    // Optimistic UI update
    set(state => ({
      worldRules: state.worldRules.map(worldRule =>
        worldRule.id === worldRuleId ? { ...worldRule, isFavorite: isFavorite } : worldRule
      ),
    }));

    try {
      await worldRuleService.updateWorldRule(userId, worldRuleId, { isFavorite });
      entityEventEmitter.emit('worldrule_changed', storyId);
    } catch (error) {
      console.error('Failed to toggle world rule favorite status:', error);
      set({ error: 'Failed to update world rule favorite status.' });
    }
  },

  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => set({ advancedSearchCriteria: criteria }),
  
  resetStore: () => set(defaultState),
}));

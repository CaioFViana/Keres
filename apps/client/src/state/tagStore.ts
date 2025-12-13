import { create } from 'zustand';
import { AppDrizzleClient } from '../db';
import { TagSelect } from '../db/schemas/tags';
import { createTagService, TagService } from '../services/TagService';
import { entityEventEmitter } from '../utils/EventEmitter';
import { debounce } from '../utils/debounce';
import { useUserSettingsStore } from './userSettingsStore';

export type FavoriteFilterState = 'all' | 'favorite' | 'not-favorite';

interface TagStore {
  tags: TagSelect[];
  searchTerm: string;
  activeFilterTags: string[];
  favoriteFilterState: FavoriteFilterState;
  activeSort: string | null;
  sortDirection: 'asc' | 'desc';
  loading: boolean;
  error: string | null;
  db: AppDrizzleClient | null;
  storyId: string | null;
  tagService: TagService | null;
  advancedSearchCriteria: { [key: string]: any };

  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchTags: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setFilterTags: (tagIds: string[]) => void;
  setFavoriteFilter: (state: FavoriteFilterState) => void;
  setSort: (sortBy: string | null, direction: 'asc' | 'desc') => void;
  toggleFavorite: (tagId: string, isFavorite: boolean) => Promise<void>;
  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => void;
  resetStore: () => void;
}

const defaultState = {
  tags: [],
  searchTerm: '',
  activeFilterTags: [],
  favoriteFilterState: 'all' as FavoriteFilterState,
  activeSort: null,
  sortDirection: 'asc' as 'asc' | 'desc',
  loading: false,
  error: null,
  db: null,
  storyId: null,
  tagService: null,
  advancedSearchCriteria: {},
};

export const useTagStore = create<TagStore>((set, get) => ({
  ...defaultState,

  setDbAndStoryId: (db, storyId) => set({ db, storyId }),
  initializeService: () => {
    const { db } = get();
    if (db) {
      set({ tagService: createTagService(db) });
    }
  },

  fetchTags: debounce(async () => {
    const { tagService, storyId, searchTerm, activeFilterTags, favoriteFilterState, activeSort, sortDirection, advancedSearchCriteria } = get();
    if (!tagService || !storyId) {
      set({ tags: [], loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const fetchedTags = await tagService.getTagsByStoryId(
        storyId,
        searchTerm,
        activeFilterTags,
        activeSort,
        sortDirection,
        favoriteFilterState,
        advancedSearchCriteria,
      );
      set({ tags: fetchedTags, loading: false });
    } catch (err) {
      console.error('Failed to fetch tags:', err);
      set({ error: 'Failed to load tags.', loading: false });
    }
  }, 300), // Debounce for 300ms

  setSearchTerm: (term: string) => set({ searchTerm: term }),
  setFilterTags: (tagIds: string[]) => set({ activeFilterTags: tagIds }),
  setFavoriteFilter: (state: FavoriteFilterState) => set({ favoriteFilterState: state }),
  setSort: (sortBy: string | null, direction: 'asc' | 'desc') => set({ activeSort: sortBy, sortDirection: direction }),

  toggleFavorite: async (tagId: string, isFavorite: boolean) => {
    const { tagService, storyId } = get();
    if (!tagService || !storyId) {
      console.warn('TagService not initialized or storyId not set.');
      return;
    }

    const userId = useUserSettingsStore.getState().userId;
    if (!userId) {
      console.error('User ID not available. Cannot toggle tag favorite status.');
      return;
    }

    // Optimistic UI update
    set(state => ({
      tags: state.tags.map(tag =>
        tag.id === tagId ? { ...tag, isFavorite: isFavorite } : tag
      ),
    }));

    try {
      await tagService.updateTag(userId, tagId, { isFavorite });
      // Removed fetchTags() call here, optimistic update already handled UI
      entityEventEmitter.emit('tag_changed', storyId); // Still emit for other listeners
    } catch (error) {
      console.error('Failed to toggle tag favorite status:', error);
      set({ error: 'Failed to update tag favorite status.' });
    }
  },

  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => set({ advancedSearchCriteria: criteria }),
  
  resetStore: () => set(defaultState),
}));
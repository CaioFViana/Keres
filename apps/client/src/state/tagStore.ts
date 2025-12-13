import { create } from 'zustand';
import { TagSelect } from '../db/schemas/tags';
import { FavoriteFilterState, TagService, createTagService } from '../services/TagService';
import { AppDrizzleClient } from '../db';

interface TagState {
  tags: TagSelect[];
  searchTerm: string;
  loading: boolean;
  error: string | null;
  db: AppDrizzleClient | null;
  storyId: string | null;
  tagService: TagService | null;
  activeSort: string | null;
  sortDirection: 'asc' | 'desc';
  favoriteFilterState: FavoriteFilterState;
  advancedSearchCriteria: { [key: string]: any };

  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchTags: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setSort: (sortBy: string | null, sortDirection: 'asc' | 'desc') => void;
  setFavoriteFilter: (state: FavoriteFilterState) => void;
  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => void;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  searchTerm: '',
  loading: false,
  error: null,
  db: null,
  storyId: null,
  tagService: null,
  activeSort: null,
  sortDirection: 'asc', // Default direction
  favoriteFilterState: 'all',
  advancedSearchCriteria: {},

  setDbAndStoryId: (dbInstance, storyIdInstance) => set({ db: dbInstance, storyId: storyIdInstance }),

  initializeService: () => {
    const { db } = get();
    if (db && !get().tagService) {
      set({ tagService: createTagService(db) });
    }
  },

  fetchTags: async () => {
    set({ loading: true, error: null });
    const { tagService, storyId, searchTerm, activeSort, sortDirection, favoriteFilterState, advancedSearchCriteria } = get();

    if (!tagService || !storyId) {
      set({ loading: false, error: 'Tag service or story ID not set.' });
      return;
    }

    try {
      const fetchedTags = await tagService.getTagsByStoryId(storyId, searchTerm, activeSort, sortDirection, favoriteFilterState, advancedSearchCriteria);
      console.log('Fetching tags:', fetchedTags);
      set({ tags: fetchedTags, loading: false });
    } catch (err) {
      console.error('Failed to fetch tags:', err);
      set({ error: 'Failed to fetch tags.', loading: false });
    }
  },

  setSearchTerm: (term) => {
    set({ searchTerm: term });
  },

  setSort: (sortBy, direction) => {
    set({ activeSort: sortBy, sortDirection: direction });
  },

  setFavoriteFilter: (state) => {
    set({ favoriteFilterState: state });
  },

  setAdvancedSearchCriteria: (criteria) => {
    set({ advancedSearchCriteria: criteria });
  },
}));

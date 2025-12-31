import { create } from 'zustand';
import { AppDrizzleClient } from '../db';
import { LocationService, LocationWithTags, createLocationService } from '../services/LocationService';
import { useUserSettingsStore } from './userSettingsStore';
import { entityEventEmitter } from '../utils/EventEmitter';

type FavoriteFilterState = 'all' | 'favorite' | 'not-favorite';

interface LocationState {
  locations: LocationWithTags[];
  searchTerm: string;
  activeFilterTags: string[];
  favoriteFilterState: FavoriteFilterState;
  activeSort: string | null;
  sortDirection: 'asc' | 'desc';
  loading: boolean;
  error: string | null;
  db: AppDrizzleClient | null;
  storyId: string | null;
  locationService: LocationService | null;
  advancedSearchCriteria: { [key: string]: any };

  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchLocations: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setFilterTags: (tags: string[]) => void;
  setFavoriteFilter: (state: FavoriteFilterState) => void;
  setSort: (sortBy: string | null, direction: 'asc' | 'desc') => void;
  toggleFavorite: (locationId: string, isFavorite: boolean) => Promise<void>;
  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => void;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  locations: [],
  searchTerm: '',
  activeFilterTags: [],
  favoriteFilterState: 'all',
  activeSort: null,
  sortDirection: 'asc',
  loading: false,
  error: null,
  db: null,
  storyId: null,
  locationService: null,
  advancedSearchCriteria: {},

  setDbAndStoryId: (dbInstance, storyIdInstance) => set({ db: dbInstance, storyId: storyIdInstance }),

  initializeService: () => {
    const { db } = get();
    if (db && !get().locationService) {
      set({ locationService: createLocationService(db) });
    }
  },

  fetchLocations: async () => {
    set({ loading: true, error: null });
    const { locationService, storyId, searchTerm, activeFilterTags, favoriteFilterState, activeSort, sortDirection, advancedSearchCriteria } = get();

    if (!locationService || !storyId) {
      set({ loading: false, error: 'Location service or story ID not set.' });
      return;
    }

    try {
      const fetchedLocations = await locationService.getLocationsByStoryId(
        storyId,
        searchTerm,
        activeFilterTags.length > 0 ? activeFilterTags : undefined,
        favoriteFilterState,
        activeSort || undefined,
        sortDirection,
        advancedSearchCriteria
      );
      set({ locations: fetchedLocations, loading: false });
    } catch (err) {
      console.error('Failed to fetch locations:', err);
      set({ error: 'Failed to fetch locations.', loading: false });
    }
  },

  setSearchTerm: (term) => {
    set({ searchTerm: term });
  },

  setFilterTags: (tags) => {
    set({ activeFilterTags: tags });
    get().fetchLocations();
  },

  setFavoriteFilter: (state) => {
    set({ favoriteFilterState: state });
    get().fetchLocations();
  },

  setSort: (sortBy, direction) => {
    set({ activeSort: sortBy, sortDirection: direction });
    get().fetchLocations();
  },

  toggleFavorite: async (locationId, isFavorite) => {
    const { locationService, storyId } = get();
    if (!locationService) {
      console.error('Location service not set.');
      return;
    }
    if (!storyId) {
      console.error('Story ID not available. Cannot toggle location favorite status.');
      return;
    }

    // Optimistic update
    set((state) => ({
      locations: state.locations.map((loc) =>
        loc.id === locationId ? { ...loc, isFavorite: isFavorite } : loc
      ),
    }));

    const userId = useUserSettingsStore.getState().userId;
    if (!userId) {
      console.error('User ID not available. Cannot toggle location favorite status.');
      return;
    }

    try {
      await locationService.updateLocation(userId, locationId, { isFavorite });
      entityEventEmitter.emit('location_changed', storyId);
    } catch (err) {
      console.error('Failed to toggle favorite status:', err);
      set({ error: 'Failed to update favorite status.' });
    }
  },

  setAdvancedSearchCriteria: (criteria) => {
    set({ advancedSearchCriteria: criteria });
    get().fetchLocations();
  },
}));

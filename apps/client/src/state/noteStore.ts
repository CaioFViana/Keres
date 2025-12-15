import { create } from 'zustand';
import { AppDrizzleClient } from '../db';
import { NoteSelect } from '../db/schemas/notes';
import { createNoteService, NoteService, NoteWithTags } from '../services/NoteService';
import { entityEventEmitter } from '../utils/EventEmitter';
import { debounce } from '../utils/debounce';
import { useUserSettingsStore } from './userSettingsStore';

export type FavoriteFilterState = 'all' | 'favorite' | 'not-favorite';

interface NoteStore {
  notes: NoteWithTags[];
  searchTerm: string;
  activeFilterTags: string[];
  favoriteFilterState: FavoriteFilterState;
  activeSort: string | null;
  sortDirection: 'asc' | 'desc';
  loading: boolean;
  error: string | null;
  db: AppDrizzleClient | null;
  storyId: string | null;
  noteService: NoteService | null;
  advancedSearchCriteria: { [key: string]: any };

  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchNotes: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setFilterTags: (tagIds: string[]) => void;
  setFavoriteFilter: (state: FavoriteFilterState) => void;
  setSort: (sortBy: string | null, direction: 'asc' | 'desc') => void;
  toggleFavorite: (noteId: string, isFavorite: boolean) => Promise<void>;
  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => void;
  resetStore: () => void;
}

const defaultState = {
  notes: [] as NoteWithTags[],
  searchTerm: '',
  activeFilterTags: [],
  favoriteFilterState: 'all' as FavoriteFilterState,
  activeSort: null,
  sortDirection: 'asc' as 'asc' | 'desc',
  loading: false,
  error: null,
  db: null,
  storyId: null,
  noteService: null,
  advancedSearchCriteria: {},
};

export const useNoteStore = create<NoteStore>((set, get) => ({
  ...defaultState,

  setDbAndStoryId: (db, storyId) => set({ db, storyId }),
  initializeService: () => {
    const { db } = get();
    if (db) {
      set({ noteService: createNoteService(db) });
    }
  },

  fetchNotes: debounce(async () => {
    const { noteService, storyId, searchTerm, activeFilterTags, favoriteFilterState, activeSort, sortDirection, advancedSearchCriteria } = get();
    if (!noteService || !storyId) {
      set({ notes: [], loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const fetchedNotes = await noteService.getNotesByStoryId(
        storyId,
        searchTerm,
        activeFilterTags,
        activeSort,
        sortDirection,
        favoriteFilterState,
        advancedSearchCriteria,
      );
      set({ notes: fetchedNotes, loading: false });
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      set({ error: 'Failed to load notes.', loading: false });
    }
  }, 300),

  setSearchTerm: (term: string) => set({ searchTerm: term }),
  setFilterTags: (tagIds: string[]) => set({ activeFilterTags: tagIds }),
  setFavoriteFilter: (state: FavoriteFilterState) => set({ favoriteFilterState: state }),
  setSort: (sortBy: string | null, direction: 'asc' | 'desc') => set({ activeSort: sortBy, sortDirection: direction }),

  toggleFavorite: async (noteId: string, isFavorite: boolean) => {
    const { noteService, storyId } = get();
    if (!noteService || !storyId) {
      console.warn('NoteService not initialized or storyId not set.');
      return;
    }

    const userId = useUserSettingsStore.getState().userId;
    if (!userId) {
      console.error('User ID not available. Cannot toggle note favorite status.');
      return;
    }

    // Optimistic UI update
    set(state => ({
      notes: state.notes.map(note =>
        note.id === noteId ? { ...note, isFavorite: isFavorite } : note
      ),
    }));

    try {
      await noteService.updateNote(userId, noteId, { isFavorite });
      entityEventEmitter.emit('note_changed', storyId);
    } catch (error) {
      console.error('Failed to toggle note favorite status:', error);
      set({ error: 'Failed to update note favorite status.' });
    }
  },

  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => set({ advancedSearchCriteria: criteria }),
  
  resetStore: () => set(defaultState),
}));

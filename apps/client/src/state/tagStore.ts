import { create } from 'zustand';
import { TagSelect } from '../db/schemas/tags';
import { TagService, createTagService } from '../services/TagService';
import { AppDrizzleClient } from '../db';

interface TagState {
  tags: TagSelect[];
  searchTerm: string; // Add searchTerm
  loading: boolean;
  error: string | null;
  db: AppDrizzleClient | null;
  storyId: string | null;
  tagService: TagService | null;

  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchTags: () => Promise<void>;
  setSearchTerm: (term: string) => void; // Add setSearchTerm
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  searchTerm: '', // Initialize searchTerm
  loading: false,
  error: null,
  db: null,
  storyId: null,
  tagService: null,

  setDbAndStoryId: (dbInstance, storyIdInstance) => set({ db: dbInstance, storyId: storyIdInstance }),

  initializeService: () => {
    const { db } = get();
    if (db && !get().tagService) {
      set({ tagService: createTagService(db) });
    }
  },

  fetchTags: async () => {
    set({ loading: true, error: null });
    const { tagService, storyId, searchTerm } = get(); // Get searchTerm

    console.log('Fetching tags for story:', storyId, 'with search term:', searchTerm); // Added log

    if (!tagService || !storyId) {
      set({ loading: false, error: 'Tag service or story ID not set.' });
      return;
    }

    try {
      const fetchedTags = await tagService.getTagsByStoryId(storyId, searchTerm); // Pass searchTerm
      console.log('Fetched tags:', fetchedTags); // Added log
      set({ tags: fetchedTags, loading: false });
    } catch (err) {
      console.error('Failed to fetch tags:', err);
      set({ error: 'Failed to fetch tags.', loading: false });
    }
  },

  setSearchTerm: (term) => {
    set({ searchTerm: term }); // Set searchTerm, fetchTags will be triggered by debounce in component
  },
}));

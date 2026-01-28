import { Story } from '@keres/shared/entities/Story';
import { create } from 'zustand';
import { createStoryService } from '../db';
import { entityEventEmitter } from '../utils/EventEmitter';

interface StoryListState {
  stories: Story[];
  setStories: (stories: Story[]) => void;
  fetchStories: (storyService: ReturnType<typeof createStoryService>) => Promise<void>;
  updateStoryFavoriteStatus: (storyId: string, isFavorite: boolean) => void;
  addStory: (story: Story) => void;
  updateStory: (story: Story) => void;
  removeStory: (storyId: string) => void;
}

export const useStoryListStore = create<StoryListState>((set, get) => ({
  stories: [],
  setStories: (stories) => set({ stories }),
  fetchStories: async (storyService) => {
    try {
      const fetchedStories = await storyService.getAllStories();
      set({ stories: fetchedStories as Story[] });
    } catch (error) {
      console.error('Error fetching stories:', error);
      // TODO: Add error notification if necessary
    }
  },
  updateStoryFavoriteStatus: (storyId, isFavorite) => {
    set((state) => ({
      stories: state.stories.map((story) =>
        story.id === storyId ? { ...story, isFavorite } : story
      ),
    }));
    entityEventEmitter.emit('story_changed', storyId);
  },
  addStory: (newStory) => {
    set((state) => ({
      stories: [...state.stories, newStory],
    }));
    entityEventEmitter.emit('story_changed', newStory.id);
  },
  updateStory: (updatedStory) => {
    set((state) => ({
      stories: state.stories.map((story) =>
        story.id === updatedStory.id ? updatedStory : story
      ),
    }));
    entityEventEmitter.emit('story_changed', updatedStory.id);
  },
  removeStory: (storyId) => {
    set((state) => ({
      stories: state.stories.filter((story) => story.id !== storyId),
    }));
    entityEventEmitter.emit('story_changed', storyId);
  },
}));

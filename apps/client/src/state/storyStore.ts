import { Story } from '@keres/shared/entities/Story';
import { create } from 'zustand';

interface StoryState {
  selectedStory: Story | null;
  setSelectedStory: (story: Story | null) => void;
}

export const useStoryStore = create<StoryState>((set) => ({
  selectedStory: null,
  setSelectedStory: (story) => set({ selectedStory: story }),
}));

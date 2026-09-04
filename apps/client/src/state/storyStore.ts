import type { Story } from '@keres/shared/entities/Story';
import { create } from 'zustand';

interface StoryState {
  selectedStory: Story | null;
  /** `null` means every Arc (the default view). */
  activeArcId: string | null;
  setSelectedStory: (story: Story | null) => void;
  setActiveArcId: (arcId: string | null) => void;
}

export const useStoryStore = create<StoryState>((set) => ({
  selectedStory: null,
  activeArcId: null,
  setSelectedStory: (story) => set({ selectedStory: story, activeArcId: null }),
  setActiveArcId: (arcId) => set({ activeArcId: arcId }),
}));

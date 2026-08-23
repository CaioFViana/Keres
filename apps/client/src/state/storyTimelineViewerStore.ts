import { create } from 'zustand';

interface StoryTimelineViewerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}
export const useStoryTimelineViewerStore = create<StoryTimelineViewerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

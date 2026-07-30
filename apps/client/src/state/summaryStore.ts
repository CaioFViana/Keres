import { create } from 'zustand';

interface StorySummary {
  totalStories: number;
  branchingStories: number;
  characterCount: number;
  choiceCount: number;
  locationCount: number;
  chapterCount: number;
  sceneCount: number;
  noteCount: number;
  worldRuleCount: number;
  branchingStoryForkCount: number;
  itemCount: number;
  galleryCount: number;
}

interface SummaryState {
  summary: StorySummary | null;
  updateSummary: (newSummary: StorySummary) => void;
  clearSummary: () => void;
}

export const useSummaryStore = create<SummaryState>((set) => ({
  summary: null,
  updateSummary: (newSummary) => set({ summary: newSummary }),
  clearSummary: () => set({ summary: null }),
}));

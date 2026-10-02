import { create } from 'zustand';
import type { PlanUsageSummary } from '../utils/planUsage';

interface PlanUsageState {
  /** The story the summary is about; a screen of another story ignores it. */
  storyId: string | null;
  summary: PlanUsageSummary | null;
  set: (storyId: string, summary: PlanUsageSummary) => void;
  clear: () => void;
}

/**
 * How close the open story is to its owner's plan, kept up to date by `PlanUsageService`. In memory only:
 * the plan is the server's, and it is read again whenever the story changes.
 */
export const usePlanUsageStore = create<PlanUsageState>((set) => ({
  storyId: null,
  summary: null,
  set: (storyId, summary) => set({ storyId, summary }),
  clear: () => set({ storyId: null, summary: null }),
}));

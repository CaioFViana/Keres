import type { Story } from '@keres/shared/entities/Story';
import type { StoryArc } from '@keres/shared/entities/StoryArc';
import { create } from 'zustand';

/**
 * The Arc whose medium and vocabulary are in effect: the selected one, or the only one the story has.
 * `null` in the every-Arc view of a story with several, where no single medium applies.
 */
export type EffectiveArc = Pick<StoryArc, 'id' | 'medium' | 'vocabulary' | 'author'>;

interface StoryState {
  selectedStory: Story | null;
  /** `null` means every Arc (the default view). */
  activeArcId: string | null;
  effectiveArc: EffectiveArc | null;
  setSelectedStory: (story: Story | null) => void;
  setActiveArcId: (arcId: string | null) => void;
  setEffectiveArc: (arc: EffectiveArc | null) => void;
}

export const useStoryStore = create<StoryState>((set) => ({
  selectedStory: null,
  activeArcId: null,
  effectiveArc: null,
  setSelectedStory: (story) => set({ selectedStory: story, activeArcId: null, effectiveArc: null }),
  setActiveArcId: (arcId) => set({ activeArcId: arcId }),
  setEffectiveArc: (arc) => set({ effectiveArc: arc }),
}));

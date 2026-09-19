import { create } from 'zustand';
import type { Guide } from '../guides/types';

export interface ActiveTour {
  guide: Guide;
  stepIndex: number;
}

interface GuideState {
  /** The tour on screen, or `null` when no tour is showing. */
  activeTour: ActiveTour | null;
  startTour: (guide: Guide) => void;
  nextStep: () => void;
  prevStep: () => void;
  /** Dismisses from any step; the host records the tour as seen. */
  skipTour: () => void;
  /** Dismisses from the last step; the host records the tour as seen. */
  completeTour: () => void;
}

/**
 * The tour player's position. It knows nothing about persistence: recording "seen" needs the
 * database, which the host (mounted under the providers) supplies when it calls skip/complete.
 */
export const useGuideStore = create<GuideState>((set) => ({
  activeTour: null,

  startTour: (guide: Guide) => {
    set({ activeTour: guide.steps.length > 0 ? { guide, stepIndex: 0 } : null });
  },

  nextStep: () => {
    set((state) => {
      if (!state.activeTour) return state;
      const last = state.activeTour.guide.steps.length - 1;
      if (state.activeTour.stepIndex >= last) return state;
      return { activeTour: { ...state.activeTour, stepIndex: state.activeTour.stepIndex + 1 } };
    });
  },

  prevStep: () => {
    set((state) => {
      if (!state.activeTour || state.activeTour.stepIndex <= 0) return state;
      return { activeTour: { ...state.activeTour, stepIndex: state.activeTour.stepIndex - 1 } };
    });
  },

  skipTour: () => {
    set({ activeTour: null });
  },

  completeTour: () => {
    set({ activeTour: null });
  },
}));

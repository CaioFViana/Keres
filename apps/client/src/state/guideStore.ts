import { create } from 'zustand';
import type { Guide } from '../guides/types';

export interface ActiveTour {
  guide: Guide;
  stepIndex: number;
}

interface GuideState {
  /** The tour on screen, or `null` when no tour is showing. */
  activeTour: ActiveTour | null;
  /**
   * Tours dismissed this session (finished or skipped), recorded synchronously. The persisted
   * "seen" history only updates after an async database write, so without this the focus effect
   * that opened the tour re-fires on dismiss and replays it once.
   */
  dismissedGuideIds: readonly string[];
  /**
   * The tour closed with "later": hidden for this focus, shown again on the next one. Unlike
   * a dismiss, it is never recorded as seen.
   */
  snoozedGuideId: string | null;
  startTour: (guide: Guide) => void;
  nextStep: () => void;
  prevStep: () => void;
  /** Dismisses from any step; the host records the tour as seen. */
  skipTour: () => void;
  /** Dismisses from the last step; the host records the tour as seen. */
  completeTour: () => void;
  /** Closes the card for this focus without recording anything. */
  snoozeTour: () => void;
  /** Allows a snoozed tour to open again; the focus hook calls this on blur. */
  clearSnooze: () => void;
  /** Drops one id from the session record, so a failed persistence write can show again. */
  undismissGuide: (guideId: string) => void;
  /** Clears the session record; the tutorials reset and the app reset both need this. */
  reset: () => void;
}

/**
 * The tour player's position. It knows nothing about persistence: recording "seen" needs the
 * database, which the host (mounted under the providers) supplies when it calls skip/complete.
 */
export const useGuideStore = create<GuideState>((set) => ({
  activeTour: null,
  dismissedGuideIds: [],
  snoozedGuideId: null,

  startTour: (guide: Guide) => {
    set((state) => {
      if (state.activeTour?.guide.id === guide.id) return state;
      return {
        activeTour: guide.steps.length > 0 ? { guide, stepIndex: 0 } : null,
      };
    });
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
    set((state) => ({
      activeTour: null,
      dismissedGuideIds: withDismissed(state, state.activeTour?.guide.id),
      snoozedGuideId: null,
    }));
  },

  completeTour: () => {
    set((state) => ({
      activeTour: null,
      dismissedGuideIds: withDismissed(state, state.activeTour?.guide.id),
      snoozedGuideId: null,
    }));
  },

  snoozeTour: () => {
    set((state) => ({
      activeTour: null,
      snoozedGuideId: state.activeTour?.guide.id ?? state.snoozedGuideId,
    }));
  },

  clearSnooze: () => {
    set({ snoozedGuideId: null });
  },

  undismissGuide: (guideId: string) => {
    set((state) => ({
      dismissedGuideIds: state.dismissedGuideIds.filter((id) => id !== guideId),
    }));
  },

  reset: () => {
    set({ activeTour: null, dismissedGuideIds: [], snoozedGuideId: null });
  },
}));

function withDismissed(state: GuideState, guideId: string | undefined): readonly string[] {
  if (!guideId || state.dismissedGuideIds.includes(guideId)) return state.dismissedGuideIds;
  return [...state.dismissedGuideIds, guideId];
}

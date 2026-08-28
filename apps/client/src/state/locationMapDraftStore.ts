import type { LocationMapContentType } from '@keres/shared';
import { create } from 'zustand';

export interface LocationMapDraft {
  mapId: string;
  storyId: string;
  content: LocationMapContentType;
  savedContent: LocationMapContentType;
}

interface LocationMapDraftState {
  draft: LocationMapDraft | null;
  remember: (draft: LocationMapDraft) => void;
  clear: () => void;
  reset: () => void;
}

/**
 * Unsaved drawing of the location map currently being edited. Survives navigating to a location
 * (the canvas unmounts). Opening a different map, changing story, or resetting the app drops it.
 */
export const useLocationMapDraftStore = create<LocationMapDraftState>((set) => ({
  draft: null,
  remember: (draft) => set({ draft }),
  clear: () => set({ draft: null }),
  reset: () => set({ draft: null }),
}));
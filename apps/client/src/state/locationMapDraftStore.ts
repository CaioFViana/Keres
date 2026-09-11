import type { LocationMapContentType } from '@keres/shared';
import { create } from 'zustand';
import {
  clearCanvasDraft,
  readCanvasDraft,
  scheduleWriteCanvasDraft,
} from '../services/canvasDraftPersistence';

export interface LocationMapDraft {
  mapId: string;
  storyId: string;
  content: LocationMapContentType;
  savedContent: LocationMapContentType;
}

interface LocationMapDraftState {
  draft: LocationMapDraft | null;
  remember: (draft: LocationMapDraft) => void;
  /** Loads an in-memory draft or a durable one from a previous session. */
  hydrate: (storyId: string, mapId: string) => Promise<LocationMapDraft | null>;
  clear: () => void;
  reset: () => void;
}

/**
 * Unsaved drawing of the location map currently being edited.
 * Survives navigating away (canvas unmounts) via memory, and process death via AsyncStorage.
 */
export const useLocationMapDraftStore = create<LocationMapDraftState>((set, get) => ({
  draft: null,
  remember: (draft) => {
    set({ draft });
    // Only keep a durable copy while the canvas differs from what SQLite already has.
    if (JSON.stringify(draft.content) === JSON.stringify(draft.savedContent)) {
      void clearCanvasDraft('location-map', draft.storyId, draft.mapId);
      return;
    }
    scheduleWriteCanvasDraft('location-map', draft.storyId, draft.mapId, draft);
  },
  hydrate: async (storyId, mapId) => {
    const current = get().draft;
    if (current && current.mapId === mapId && current.storyId === storyId) {
      return current;
    }
    if (current && (current.mapId !== mapId || current.storyId !== storyId)) {
      get().clear();
    }
    const durable = await readCanvasDraft<LocationMapDraft>('location-map', storyId, mapId);
    if (
      durable &&
      durable.mapId === mapId &&
      durable.storyId === storyId &&
      durable.content &&
      durable.savedContent
    ) {
      set({ draft: durable });
      return durable;
    }
    return null;
  },
  clear: () => {
    const current = get().draft;
    set({ draft: null });
    if (current) {
      void clearCanvasDraft('location-map', current.storyId, current.mapId);
    }
  },
  reset: () => {
    // Board draft reset already clears every canvas draft key; keep this memory-only.
    set({ draft: null });
  },
}));

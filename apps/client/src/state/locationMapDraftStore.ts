import type { LocationMapContentType } from '@keres/shared';
import { create } from 'zustand';
import {
  CANVAS_DRAFT_FIELD,
  clearBoundEditorDraft,
  isEditorDraftDbBound,
  readBoundEditorDraft,
  scheduleWriteEditorDraft,
  writeEditorDraftNow,
} from '../services/EditorDraftService';
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

function isLocationMapDraft(
  value: unknown,
  storyId: string,
  mapId: string,
): value is LocationMapDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<LocationMapDraft>;
  return (
    draft.mapId === mapId && draft.storyId === storyId && !!draft.content && !!draft.savedContent
  );
}

/**
 * Unsaved drawing of the location map currently being edited.
 * Survives navigating away (canvas unmounts) via memory, and process death via the editor_drafts
 * table - with a one-time transparent adoption of drafts left in AsyncStorage by older versions.
 */
export const useLocationMapDraftStore = create<LocationMapDraftState>((set, get) => ({
  draft: null,
  remember: (draft) => {
    set({ draft });
    // Only keep a durable copy while the canvas differs from what SQLite already has.
    if (JSON.stringify(draft.content) === JSON.stringify(draft.savedContent)) {
      void clearBoundEditorDraft(draft.storyId, 'LocationMap', draft.mapId, CANVAS_DRAFT_FIELD);
      void clearCanvasDraft('location-map', draft.storyId, draft.mapId);
      return;
    }
    if (isEditorDraftDbBound()) {
      scheduleWriteEditorDraft(
        draft.storyId,
        'LocationMap',
        draft.mapId,
        CANVAS_DRAFT_FIELD,
        JSON.stringify(draft),
      );
    } else {
      scheduleWriteCanvasDraft('location-map', draft.storyId, draft.mapId, draft);
    }
  },
  hydrate: async (storyId, mapId) => {
    const current = get().draft;
    if (current && current.mapId === mapId && current.storyId === storyId) {
      return current;
    }
    if (current && (current.mapId !== mapId || current.storyId !== storyId)) {
      get().clear();
    }
    if (isEditorDraftDbBound()) {
      const row = await readBoundEditorDraft(storyId, 'LocationMap', mapId, CANVAS_DRAFT_FIELD);
      if (row) {
        try {
          const parsed = JSON.parse(row.content) as unknown;
          if (isLocationMapDraft(parsed, storyId, mapId)) {
            set({ draft: parsed });
            return parsed;
          }
        } catch (error) {
          console.error('Corrupt location map draft ignored:', error);
        }
      }
      const legacy = await readCanvasDraft<LocationMapDraft>('location-map', storyId, mapId);
      if (legacy && isLocationMapDraft(legacy, storyId, mapId)) {
        set({ draft: legacy });
        const stored = await writeEditorDraftNow(
          storyId,
          'LocationMap',
          mapId,
          CANVAS_DRAFT_FIELD,
          JSON.stringify(legacy),
        );
        if (stored) await clearCanvasDraft('location-map', storyId, mapId);
        return legacy;
      }
      return null;
    }
    const durable = await readCanvasDraft<LocationMapDraft>('location-map', storyId, mapId);
    if (durable && isLocationMapDraft(durable, storyId, mapId)) {
      set({ draft: durable });
      return durable;
    }
    return null;
  },
  clear: () => {
    const current = get().draft;
    set({ draft: null });
    if (current) {
      void clearBoundEditorDraft(current.storyId, 'LocationMap', current.mapId, CANVAS_DRAFT_FIELD);
      void clearCanvasDraft('location-map', current.storyId, current.mapId);
    }
  },
  reset: () => {
    // Board draft reset already clears every durable draft, SQLite and legacy; keep this memory-only.
    set({ draft: null });
  },
}));

import type { SketchContentType } from '@keres/shared';
import { create } from 'zustand';
import {
  CANVAS_DRAFT_FIELD,
  clearAllBoundEditorDrafts,
  clearBoundEditorDraft,
  isEditorDraftDbBound,
  readBoundEditorDraft,
  scheduleWriteEditorDraft,
  writeEditorDraftNow,
} from '../services/EditorDraftService';
import {
  clearAllCanvasDrafts,
  clearCanvasDraft,
  readCanvasDraft,
  scheduleWriteCanvasDraft,
  writeCanvasDraftNow,
} from '../services/canvasDraftPersistence';

export interface SketchDraft {
  sketchId: string;
  storyId: string;
  content: SketchContentType;
  savedContent: SketchContentType;
}

interface SketchDraftState {
  draft: SketchDraft | null;
  remember: (draft: SketchDraft) => void;
  /** Loads an in-memory draft or a durable one from a previous session. */
  hydrate: (storyId: string, sketchId: string) => Promise<SketchDraft | null>;
  clear: () => void;
  reset: () => void;
}

function isSketchDraft(value: unknown, storyId: string, sketchId: string): value is SketchDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<SketchDraft>;
  return (
    draft.sketchId === sketchId &&
    draft.storyId === storyId &&
    !!draft.content &&
    !!draft.savedContent
  );
}

function isClean(draft: SketchDraft): boolean {
  return JSON.stringify(draft.content) === JSON.stringify(draft.savedContent);
}

/** Durable write, debounced: only while the canvas differs from what SQLite already has. */
function persistDraft(draft: SketchDraft): void {
  if (isClean(draft)) {
    void clearBoundEditorDraft(draft.storyId, 'Sketch', draft.sketchId, CANVAS_DRAFT_FIELD);
    void clearCanvasDraft('sketch', draft.storyId, draft.sketchId);
    return;
  }
  if (isEditorDraftDbBound()) {
    scheduleWriteEditorDraft(
      draft.storyId,
      'Sketch',
      draft.sketchId,
      CANVAS_DRAFT_FIELD,
      JSON.stringify(draft),
    );
  } else {
    scheduleWriteCanvasDraft('sketch', draft.storyId, draft.sketchId, draft);
  }
}

/**
 * Immediate durable write, for sketch switches: the outgoing drawing must be flushed, never
 * dropped - each sketch keeps its own unsaved work. A superseded legacy key is removed once the
 * SQLite copy exists, since reads prefer SQLite from then on.
 */
async function persistDraftNow(draft: SketchDraft): Promise<void> {
  if (isClean(draft)) {
    await clearBoundEditorDraft(draft.storyId, 'Sketch', draft.sketchId, CANVAS_DRAFT_FIELD);
    await clearCanvasDraft('sketch', draft.storyId, draft.sketchId);
    return;
  }
  if (isEditorDraftDbBound()) {
    const stored = await writeEditorDraftNow(
      draft.storyId,
      'Sketch',
      draft.sketchId,
      CANVAS_DRAFT_FIELD,
      JSON.stringify(draft),
    );
    if (stored) await clearCanvasDraft('sketch', draft.storyId, draft.sketchId);
  } else {
    await writeCanvasDraftNow('sketch', draft.storyId, draft.sketchId, draft);
  }
}

async function readDurableDraft(storyId: string, sketchId: string): Promise<SketchDraft | null> {
  if (isEditorDraftDbBound()) {
    const row = await readBoundEditorDraft(storyId, 'Sketch', sketchId, CANVAS_DRAFT_FIELD);
    if (row) {
      try {
        const parsed = JSON.parse(row.content) as unknown;
        if (isSketchDraft(parsed, storyId, sketchId)) return parsed;
      } catch (error) {
        console.error('Corrupt sketch draft ignored:', error);
      }
    }
    // One-time transparent adoption of drafts left in AsyncStorage by older versions.
    const legacy = await readCanvasDraft<SketchDraft>('sketch', storyId, sketchId);
    if (legacy && isSketchDraft(legacy, storyId, sketchId)) {
      const stored = await writeEditorDraftNow(
        storyId,
        'Sketch',
        sketchId,
        CANVAS_DRAFT_FIELD,
        JSON.stringify(legacy),
      );
      if (stored) await clearCanvasDraft('sketch', storyId, sketchId);
      return legacy;
    }
    return null;
  }
  const durable = await readCanvasDraft<SketchDraft>('sketch', storyId, sketchId);
  return durable && isSketchDraft(durable, storyId, sketchId) ? durable : null;
}

/**
 * Unsaved drawing of the sketch currently being edited.
 * Survives navigating away (canvas unmounts) via memory, process death via the editor_drafts
 * table, and sketch switches via flush-on-switch - every sketch keeps its own unsaved work until
 * it is saved or explicitly cleared.
 */
export const useSketchDraftStore = create<SketchDraftState>((set, get) => ({
  draft: null,
  remember: (draft) => {
    set({ draft });
    persistDraft(draft);
  },
  hydrate: async (storyId, sketchId) => {
    const current = get().draft;
    if (current && current.sketchId === sketchId && current.storyId === storyId) {
      return current;
    }
    if (current && (current.sketchId !== sketchId || current.storyId !== storyId)) {
      await persistDraftNow(current);
      set({ draft: null });
    }
    const durable = await readDurableDraft(storyId, sketchId);
    if (durable) {
      set({ draft: durable });
      return durable;
    }
    return null;
  },
  clear: () => {
    const current = get().draft;
    set({ draft: null });
    if (current) {
      void clearBoundEditorDraft(current.storyId, 'Sketch', current.sketchId, CANVAS_DRAFT_FIELD);
      void clearCanvasDraft('sketch', current.storyId, current.sketchId);
    }
  },
  reset: () => {
    set({ draft: null });
    void clearAllBoundEditorDrafts();
    void clearAllCanvasDrafts();
  },
}));

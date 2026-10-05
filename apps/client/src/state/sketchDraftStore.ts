import {
  decodeSketchDocument,
  encodeSketchDocument,
  validateSketchContent,
  type SketchContentType,
  type SketchDocument,
} from '@keres/shared';
import { create } from 'zustand';
import {
  CANVAS_DRAFT_FIELD,
  clearAllBoundEditorDrafts,
  clearBoundEditorDraft,
  isEditorDraftDbBound,
  readBoundEditorDraft,
  writeEditorDraftNow,
} from '../services/EditorDraftService';
import {
  clearAllCanvasDrafts,
  clearCanvasDraft,
  readCanvasDraft,
  writeCanvasDraftNow,
} from '../services/canvasDraftPersistence';

/**
 * Unsaved drawing of the sketch being edited. In memory it holds the decoded documents (the
 * undo history shares their items, so it is cheap); on disk only the encoded content and the
 * row version it was based on are kept - never a second copy of the saved drawing, and never
 * encoded on every stroke: the write waits for the drawing to rest.
 */
export interface SketchDraft {
  sketchId: string;
  storyId: string;
  doc: SketchDocument;
  /** The document as last loaded or saved; `doc !== savedDoc` is the dirty check. */
  savedDoc: SketchDocument;
  /** `version` of the row the draft started from, to flag a newer synced copy. */
  baseVersion: number;
}

interface StoredSketchDraft {
  sketchId: string;
  storyId: string;
  baseVersion: number;
  content: SketchContentType;
}

/** Quiet time before the drawing is encoded and written; encoding is the expensive part. */
const WRITE_DELAY_MS = 1200;

interface SketchDraftState {
  draft: SketchDraft | null;
  remember: (draft: SketchDraft) => void;
  /** Loads the in-memory draft or a durable one from a previous session. */
  hydrate: (storyId: string, sketchId: string) => Promise<SketchDraft | null>;
  /** Writes a draft still waiting out its delay (the app is going to the background). */
  flush: () => Promise<void>;
  clear: () => void;
  reset: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

function cancelTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function serialize(draft: SketchDraft): StoredSketchDraft {
  return {
    sketchId: draft.sketchId,
    storyId: draft.storyId,
    baseVersion: draft.baseVersion,
    content: encodeSketchDocument(draft.doc),
  };
}

function isDirty(draft: SketchDraft): boolean {
  return draft.doc !== draft.savedDoc;
}

async function clearDurable(draft: { storyId: string; sketchId: string }) {
  await Promise.all([
    clearBoundEditorDraft(draft.storyId, 'Sketch', draft.sketchId, CANVAS_DRAFT_FIELD),
    clearCanvasDraft('sketch', draft.storyId, draft.sketchId),
  ]);
}

async function persistNow(draft: SketchDraft): Promise<void> {
  if (!isDirty(draft)) {
    await clearDurable(draft);
    return;
  }
  const stored = serialize(draft);
  if (isEditorDraftDbBound()) {
    const written = await writeEditorDraftNow(
      draft.storyId,
      'Sketch',
      draft.sketchId,
      CANVAS_DRAFT_FIELD,
      JSON.stringify(stored),
    );
    if (written) await clearCanvasDraft('sketch', draft.storyId, draft.sketchId);
  } else {
    await writeCanvasDraftNow('sketch', draft.storyId, draft.sketchId, stored);
  }
}

function isStored(value: unknown, storyId: string, sketchId: string): value is StoredSketchDraft {
  if (!value || typeof value !== 'object') return false;
  const stored = value as Partial<StoredSketchDraft>;
  return (
    stored.sketchId === sketchId &&
    stored.storyId === storyId &&
    typeof stored.baseVersion === 'number' &&
    !!stored.content
  );
}

/** Rebuilds a draft from disk; a draft that no longer validates is dropped, not half-loaded. */
function revive(stored: StoredSketchDraft, savedDoc: SketchDocument | null): SketchDraft | null {
  try {
    const doc = decodeSketchDocument(validateSketchContent(stored.content));
    return {
      sketchId: stored.sketchId,
      storyId: stored.storyId,
      doc,
      // Until the screen provides the saved row, the revived draft counts as dirty.
      savedDoc: savedDoc ?? { ...doc, layers: [], overlays: [] },
      baseVersion: stored.baseVersion,
    };
  } catch (error) {
    console.error('Corrupt sketch draft ignored:', error);
    return null;
  }
}

async function readDurable(storyId: string, sketchId: string): Promise<StoredSketchDraft | null> {
  if (isEditorDraftDbBound()) {
    const row = await readBoundEditorDraft(storyId, 'Sketch', sketchId, CANVAS_DRAFT_FIELD);
    if (!row) return null;
    try {
      const parsed = JSON.parse(row.content) as unknown;
      return isStored(parsed, storyId, sketchId) ? parsed : null;
    } catch (error) {
      console.error('Corrupt sketch draft ignored:', error);
      return null;
    }
  }
  const durable = await readCanvasDraft<StoredSketchDraft>('sketch', storyId, sketchId);
  return durable && isStored(durable, storyId, sketchId) ? durable : null;
}

export const useSketchDraftStore = create<SketchDraftState>((set, get) => ({
  draft: null,
  remember: (draft) => {
    set({ draft });
    cancelTimer();
    if (!isDirty(draft)) {
      void clearDurable(draft);
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      const current = get().draft;
      if (current)
        void persistNow(current).catch((error) =>
          console.error('Failed to write sketch draft:', error),
        );
    }, WRITE_DELAY_MS);
  },
  hydrate: async (storyId, sketchId) => {
    const current = get().draft;
    if (current && current.sketchId === sketchId && current.storyId === storyId) return current;
    if (current) {
      cancelTimer();
      await persistNow(current);
      set({ draft: null });
    }
    const stored = await readDurable(storyId, sketchId);
    if (!stored) return null;
    const revived = revive(stored, null);
    if (revived) set({ draft: revived });
    return revived;
  },
  flush: async () => {
    const current = get().draft;
    if (!current || !timer) return;
    cancelTimer();
    await persistNow(current);
  },
  clear: () => {
    const current = get().draft;
    cancelTimer();
    set({ draft: null });
    if (current) void clearDurable(current);
  },
  reset: () => {
    cancelTimer();
    set({ draft: null });
    void clearAllBoundEditorDrafts();
    void clearAllCanvasDrafts();
  },
}));

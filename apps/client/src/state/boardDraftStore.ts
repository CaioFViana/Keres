import type { BoardContentType } from '@keres/shared';
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

export interface BoardDraft {
  boardId: string;
  storyId: string;
  content: BoardContentType;
  savedContent: BoardContentType;
}

interface BoardDraftState {
  draft: BoardDraft | null;
  remember: (draft: BoardDraft) => void;
  /** Loads an in-memory draft or a durable one from a previous session. */
  hydrate: (storyId: string, boardId: string) => Promise<BoardDraft | null>;
  clear: () => void;
  reset: () => void;
}

function isBoardDraft(value: unknown, storyId: string, boardId: string): value is BoardDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<BoardDraft>;
  return (
    draft.boardId === boardId &&
    draft.storyId === storyId &&
    !!draft.content &&
    !!draft.savedContent
  );
}

function isClean(draft: BoardDraft): boolean {
  return JSON.stringify(draft.content) === JSON.stringify(draft.savedContent);
}

/** Durable write, debounced: only while the canvas differs from what SQLite already has. */
function persistDraft(draft: BoardDraft): void {
  if (isClean(draft)) {
    void clearBoundEditorDraft(draft.storyId, 'Board', draft.boardId, CANVAS_DRAFT_FIELD);
    void clearCanvasDraft('board', draft.storyId, draft.boardId);
    return;
  }
  if (isEditorDraftDbBound()) {
    scheduleWriteEditorDraft(
      draft.storyId,
      'Board',
      draft.boardId,
      CANVAS_DRAFT_FIELD,
      JSON.stringify(draft),
    );
  } else {
    scheduleWriteCanvasDraft('board', draft.storyId, draft.boardId, draft);
  }
}

/**
 * Immediate durable write, for board switches: the outgoing drawing must be flushed, never
 * dropped - each board keeps its own unsaved work. A superseded legacy key is removed once the
 * SQLite copy exists, since reads prefer SQLite from then on.
 */
async function persistDraftNow(draft: BoardDraft): Promise<void> {
  if (isClean(draft)) {
    await clearBoundEditorDraft(draft.storyId, 'Board', draft.boardId, CANVAS_DRAFT_FIELD);
    await clearCanvasDraft('board', draft.storyId, draft.boardId);
    return;
  }
  if (isEditorDraftDbBound()) {
    const stored = await writeEditorDraftNow(
      draft.storyId,
      'Board',
      draft.boardId,
      CANVAS_DRAFT_FIELD,
      JSON.stringify(draft),
    );
    if (stored) await clearCanvasDraft('board', draft.storyId, draft.boardId);
  } else {
    await writeCanvasDraftNow('board', draft.storyId, draft.boardId, draft);
  }
}

async function readDurableDraft(storyId: string, boardId: string): Promise<BoardDraft | null> {
  if (isEditorDraftDbBound()) {
    const row = await readBoundEditorDraft(storyId, 'Board', boardId, CANVAS_DRAFT_FIELD);
    if (row) {
      try {
        const parsed = JSON.parse(row.content) as unknown;
        if (isBoardDraft(parsed, storyId, boardId)) return parsed;
      } catch (error) {
        console.error('Corrupt board draft ignored:', error);
      }
    }
    // One-time transparent adoption of drafts left in AsyncStorage by older versions.
    const legacy = await readCanvasDraft<BoardDraft>('board', storyId, boardId);
    if (legacy && isBoardDraft(legacy, storyId, boardId)) {
      const stored = await writeEditorDraftNow(
        storyId,
        'Board',
        boardId,
        CANVAS_DRAFT_FIELD,
        JSON.stringify(legacy),
      );
      if (stored) await clearCanvasDraft('board', storyId, boardId);
      return legacy;
    }
    return null;
  }
  const durable = await readCanvasDraft<BoardDraft>('board', storyId, boardId);
  return durable && isBoardDraft(durable, storyId, boardId) ? durable : null;
}

/**
 * Unsaved drawing of the board currently being edited.
 * Survives navigating away (canvas unmounts) via memory, process death via the editor_drafts
 * table, and board switches via flush-on-switch - every board keeps its own unsaved work until
 * it is saved or explicitly cleared.
 */
export const useBoardDraftStore = create<BoardDraftState>((set, get) => ({
  draft: null,
  remember: (draft) => {
    set({ draft });
    persistDraft(draft);
  },
  hydrate: async (storyId, boardId) => {
    const current = get().draft;
    if (current && current.boardId === boardId && current.storyId === storyId) {
      return current;
    }
    if (current && (current.boardId !== boardId || current.storyId !== storyId)) {
      await persistDraftNow(current);
      set({ draft: null });
    }
    const durable = await readDurableDraft(storyId, boardId);
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
      void clearBoundEditorDraft(current.storyId, 'Board', current.boardId, CANVAS_DRAFT_FIELD);
      void clearCanvasDraft('board', current.storyId, current.boardId);
    }
  },
  reset: () => {
    set({ draft: null });
    void clearAllBoundEditorDrafts();
    void clearAllCanvasDrafts();
  },
}));

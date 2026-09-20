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

/**
 * Unsaved drawing of the board currently being edited.
 * Survives navigating away (canvas unmounts) via memory, and process death via the editor_drafts
 * table - with a one-time transparent adoption of drafts left in AsyncStorage by older versions.
 */
export const useBoardDraftStore = create<BoardDraftState>((set, get) => ({
  draft: null,
  remember: (draft) => {
    set({ draft });
    // Only keep a durable copy while the canvas differs from what SQLite already has.
    if (JSON.stringify(draft.content) === JSON.stringify(draft.savedContent)) {
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
  },
  hydrate: async (storyId, boardId) => {
    const current = get().draft;
    if (current && current.boardId === boardId && current.storyId === storyId) {
      return current;
    }
    if (current && (current.boardId !== boardId || current.storyId !== storyId)) {
      get().clear();
    }
    if (isEditorDraftDbBound()) {
      const row = await readBoundEditorDraft(storyId, 'Board', boardId, CANVAS_DRAFT_FIELD);
      if (row) {
        try {
          const parsed = JSON.parse(row.content) as unknown;
          if (isBoardDraft(parsed, storyId, boardId)) {
            set({ draft: parsed });
            return parsed;
          }
        } catch (error) {
          console.error('Corrupt board draft ignored:', error);
        }
      }
      const legacy = await readCanvasDraft<BoardDraft>('board', storyId, boardId);
      if (legacy && isBoardDraft(legacy, storyId, boardId)) {
        set({ draft: legacy });
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
    if (durable && isBoardDraft(durable, storyId, boardId)) {
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

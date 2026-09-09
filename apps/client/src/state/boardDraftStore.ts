import type { BoardContentType } from '@keres/shared';
import { create } from 'zustand';
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

/**
 * Unsaved drawing of the board currently being edited.
 * Survives navigating away (canvas unmounts) via memory, and process death via AsyncStorage.
 */
export const useBoardDraftStore = create<BoardDraftState>((set, get) => ({
  draft: null,
  remember: (draft) => {
    set({ draft });
    // Only keep a durable copy while the canvas differs from what SQLite already has.
    if (JSON.stringify(draft.content) === JSON.stringify(draft.savedContent)) {
      void clearCanvasDraft('board', draft.storyId, draft.boardId);
      return;
    }
    scheduleWriteCanvasDraft('board', draft.storyId, draft.boardId, draft);
  },
  hydrate: async (storyId, boardId) => {
    const current = get().draft;
    if (current && current.boardId === boardId && current.storyId === storyId) {
      return current;
    }
    if (current && (current.boardId !== boardId || current.storyId !== storyId)) {
      get().clear();
    }
    const durable = await readCanvasDraft<BoardDraft>('board', storyId, boardId);
    if (
      durable &&
      durable.boardId === boardId &&
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
      void clearCanvasDraft('board', current.storyId, current.boardId);
    }
  },
  reset: () => {
    set({ draft: null });
    void clearAllCanvasDrafts();
  },
}));

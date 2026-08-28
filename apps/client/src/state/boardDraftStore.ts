import type { BoardContentType } from '@keres/shared';
import { create } from 'zustand';

export interface BoardDraft {
  boardId: string;
  storyId: string;
  content: BoardContentType;
  savedContent: BoardContentType;
}

interface BoardDraftState {
  draft: BoardDraft | null;
  remember: (draft: BoardDraft) => void;
  clear: () => void;
  reset: () => void;
}

/**
 * Unsaved drawing of the board currently being edited. Survives navigating to an entity
 * (the canvas unmounts). Opening a different board, changing story, or resetting the app drops it.
 */
export const useBoardDraftStore = create<BoardDraftState>((set) => ({
  draft: null,
  remember: (draft) => set({ draft }),
  clear: () => set({ draft: null }),
  reset: () => set({ draft: null }),
}));

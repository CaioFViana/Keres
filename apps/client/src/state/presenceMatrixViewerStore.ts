import { create } from 'zustand';

export type PresenceMatrixViewerRequest =
  | { kind: 'character'; characterId?: string }
  | { kind: 'item'; itemId?: string };
interface PresenceMatrixViewerState {
  request: PresenceMatrixViewerRequest | null;
  openCharacter: (characterId: string) => void;
  openItem: (itemId: string) => void;
  openCharacterList: () => void;
  openItemList: () => void;
  close: () => void;
}
export const usePresenceMatrixViewerStore = create<PresenceMatrixViewerState>((set) => ({
  request: null,
  openCharacter: (characterId) => set({ request: { kind: 'character', characterId } }),
  openItem: (itemId) => set({ request: { kind: 'item', itemId } }),
  openCharacterList: () => set({ request: { kind: 'character' } }),
  openItemList: () => set({ request: { kind: 'item' } }),
  close: () => set({ request: null }),
}));

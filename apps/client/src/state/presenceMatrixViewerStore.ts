import { create } from 'zustand';

type ViewerRequest = { kind: 'character'; characterId: string } | { kind: 'item'; itemId: string };
interface PresenceMatrixViewerState {
  request: ViewerRequest | null;
  openCharacter: (characterId: string) => void;
  openItem: (itemId: string) => void;
  close: () => void;
}
export const usePresenceMatrixViewerStore = create<PresenceMatrixViewerState>((set) => ({
  request: null,
  openCharacter: (characterId) => set({ request: { kind: 'character', characterId } }),
  openItem: (itemId) => set({ request: { kind: 'item', itemId } }),
  close: () => set({ request: null }),
}));

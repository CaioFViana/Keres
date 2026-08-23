import { useCallback } from 'react';
import { usePresenceMatrixViewerStore } from '../state/presenceMatrixViewerStore';

export function useOpenPresenceMatrixViewer() {
  const openCharacter = usePresenceMatrixViewerStore((state) => state.openCharacter);
  const openItem = usePresenceMatrixViewerStore((state) => state.openItem);
  return {
    openCharacter: useCallback((id: string) => openCharacter(id), [openCharacter]),
    openItem: useCallback((id: string) => openItem(id), [openItem]),
  };
}

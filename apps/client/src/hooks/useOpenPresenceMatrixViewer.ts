import { useCallback } from 'react';
import { usePresenceMatrixViewerStore } from '../state/presenceMatrixViewerStore';

export function useOpenPresenceMatrixViewer() {
  const openCharacter = usePresenceMatrixViewerStore((state) => state.openCharacter);
  const openItem = usePresenceMatrixViewerStore((state) => state.openItem);
  const openCharacterList = usePresenceMatrixViewerStore((state) => state.openCharacterList);
  const openItemList = usePresenceMatrixViewerStore((state) => state.openItemList);
  return {
    openCharacter: useCallback((id: string) => openCharacter(id), [openCharacter]),
    openItem: useCallback((id: string) => openItem(id), [openItem]),
    openCharacterList: useCallback(() => openCharacterList(), [openCharacterList]),
    openItemList: useCallback(() => openItemList(), [openItemList]),
  };
}

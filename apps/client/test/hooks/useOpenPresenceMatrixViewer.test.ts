import { act, renderHook } from '@testing-library/react-native';
import { useOpenPresenceMatrixViewer } from '../../src/hooks/useOpenPresenceMatrixViewer';
import { usePresenceMatrixViewerStore } from '../../src/state/presenceMatrixViewerStore';

beforeEach(() => usePresenceMatrixViewerStore.getState().close());

describe('useOpenPresenceMatrixViewer', () => {
  it('opens individual character and item requests in the shared viewer store', async () => {
    const view = await renderHook(() => useOpenPresenceMatrixViewer());

    await act(async () => view.result.current.openCharacter('character-1'));
    expect(usePresenceMatrixViewerStore.getState().request).toEqual({
      kind: 'character',
      characterId: 'character-1',
    });

    await act(async () => view.result.current.openItem('item-1'));
    expect(usePresenceMatrixViewerStore.getState().request).toEqual({
      kind: 'item',
      itemId: 'item-1',
    });
  });

  it('opens the unfiltered character and item catalogs', async () => {
    const view = await renderHook(() => useOpenPresenceMatrixViewer());

    await act(async () => view.result.current.openCharacterList());
    expect(usePresenceMatrixViewerStore.getState().request).toEqual({ kind: 'character' });

    await act(async () => view.result.current.openItemList());
    expect(usePresenceMatrixViewerStore.getState().request).toEqual({ kind: 'item' });
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { useIconRecents } from '../../src/hooks/useIconRecents';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('useIconRecents', () => {
  it('starts empty and remembers picks most recent first', async () => {
    const view = await renderHook(() => useIconRecents());
    await act(async () => {});
    expect(view.result.current.recents).toEqual([]);

    await act(async () => view.result.current.remember('flag'));
    await act(async () => view.result.current.remember('keres:castle'));
    await act(async () => view.result.current.remember('flag'));
    expect(view.result.current.recents).toEqual(['flag', 'keres:castle']);
    expect(JSON.parse((await AsyncStorage.getItem('@keres/icon-recents')) ?? '[]')).toEqual([
      'flag',
      'keres:castle',
    ]);
  });

  it('loads stored recents capped and cleaned', async () => {
    await AsyncStorage.setItem(
      '@keres/icon-recents',
      JSON.stringify(['a', 1, 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', null]),
    );
    const view = await renderHook(() => useIconRecents());
    await act(async () => {});

    expect(view.result.current.recents).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('reads corrupt entries as empty', async () => {
    await AsyncStorage.setItem('@keres/icon-recents', 'not-json');
    const view = await renderHook(() => useIconRecents());
    await act(async () => {});

    expect(view.result.current.recents).toEqual([]);
  });
});

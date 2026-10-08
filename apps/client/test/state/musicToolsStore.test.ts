import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useMusicTools } from '../../src/hooks/useMusicTools';
import { useMusicToolsStore } from '../../src/state/musicToolsStore';

beforeEach(async () => {
  await AsyncStorage.clear();
  useMusicToolsStore.getState().reset();
});

describe('the music tools choice', () => {
  it('is off until the person switches it on', () => {
    expect(useMusicToolsStore.getState().enabled).toBe(false);
  });

  it('keeps what was chosen on the device', async () => {
    useMusicToolsStore.getState().setEnabled(true);

    await waitFor(async () =>
      expect(await AsyncStorage.getItem('@keres/music-tools')).toBe('true'),
    );
    useMusicToolsStore.getState().setEnabled(false);
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('@keres/music-tools')).toBe('false'),
    );
  });

  it('brings back a choice kept in an earlier run, the first time it is asked', async () => {
    await AsyncStorage.setItem('@keres/music-tools', 'true');

    const { result } = await renderHook(() => useMusicTools());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('reads anything else it finds as off', async () => {
    await AsyncStorage.setItem('@keres/music-tools', 'maybe');

    const { result } = await renderHook(() => useMusicTools());

    await waitFor(() => expect(useMusicToolsStore.getState().hydrate).toBeDefined());
    expect(result.current).toBe(false);
  });

  it('is forgotten when the application is reset', async () => {
    useMusicToolsStore.getState().setEnabled(true);

    useMusicToolsStore.getState().reset();

    expect(useMusicToolsStore.getState().enabled).toBe(false);
    await waitFor(async () => expect(await AsyncStorage.getItem('@keres/music-tools')).toBeNull());
  });
});

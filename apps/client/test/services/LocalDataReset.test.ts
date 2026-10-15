import AsyncStorage from '@react-native-async-storage/async-storage';

const mockDeleteCjkPack = jest.fn();
const mockPrune = jest.fn();

jest.mock('@/src/services/cjkFontPack', () => ({
  __esModule: true,
  deleteCjkPack: (...args: unknown[]) => mockDeleteCjkPack(...args),
}));
jest.mock('@/src/services/SongAudioService', () => ({
  __esModule: true,
  defaultSongAudioStore: () => ({ prune: (...args: unknown[]) => mockPrune(...args) }),
}));

import {
  clearDownloadedFiles,
  clearEverythingOutsideDatabase,
  clearLocalPreferences,
} from '@/src/services/LocalDataReset';
import { getAcceptedClientLegal, setAcceptedClientLegal } from '@/src/legal/clientTermsAcceptance';

beforeEach(async () => {
  jest.clearAllMocks();
  mockDeleteCjkPack.mockResolvedValue(undefined);
  mockPrune.mockResolvedValue(undefined);
  await AsyncStorage.clear();
});

describe('clearLocalPreferences', () => {
  it('removes every entry the app wrote: what was accepted, drafts, recents, switches', async () => {
    await setAcceptedClientLegal('terms', 3, 'onboarding');
    await setAcceptedClientLegal('privacy', 2, 'onboarding');
    await AsyncStorage.multiSet([
      ['@keres/icon-recents', '["star"]'],
      ['@keres/music-tools', 'true'],
      ['@keres/messages-seen', '{}'],
      ['keres:canvas-draft:sketch:s1:c1', '{}'],
      ['some-drawer-group-state', '{"open":["write"]}'],
    ]);

    await clearLocalPreferences();

    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(await getAcceptedClientLegal('terms')).toBeNull();
    expect(await getAcceptedClientLegal('privacy')).toBeNull();
  });

  it("leaves the admin panel's entries alone when the app is served together with it", async () => {
    await AsyncStorage.multiSet([
      ['keres_admin_access_token', 'token'],
      ['keres_admin_language', 'pt'],
      ['@keres/icon-recents', '[]'],
    ]);

    await clearLocalPreferences();

    expect([...(await AsyncStorage.getAllKeys())].sort()).toEqual([
      'keres_admin_access_token',
      'keres_admin_language',
    ]);
  });

  it('is fine with nothing stored', async () => {
    await expect(clearLocalPreferences()).resolves.toBeUndefined();
  });
});

describe('clearDownloadedFiles', () => {
  it('removes the CJK font pack and the song renderings', async () => {
    await clearDownloadedFiles();

    expect(mockDeleteCjkPack).toHaveBeenCalledTimes(1);
    expect(mockPrune).toHaveBeenCalledWith(0);
  });

  it('goes on with the renderings when the font pack cannot be removed', async () => {
    mockDeleteCjkPack.mockRejectedValue(new Error('locked'));

    await clearDownloadedFiles();

    expect(mockPrune).toHaveBeenCalledWith(0);
  });
});

describe('clearEverythingOutsideDatabase', () => {
  it('does both, and a storage that will not answer does not stop the files from going', async () => {
    jest.spyOn(AsyncStorage, 'getAllKeys').mockRejectedValueOnce(new Error('no storage'));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    await clearEverythingOutsideDatabase();

    expect(mockDeleteCjkPack).toHaveBeenCalled();
    expect(mockPrune).toHaveBeenCalledWith(0);
    log.mockRestore();
  });
});

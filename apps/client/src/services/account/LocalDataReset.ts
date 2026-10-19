import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteCjkPack } from '@/src/services/platform-web/cjkFontPack';
import { defaultSongAudioStore } from '@/src/services/media/SongAudioService';

/**
 * What the application reset must also forget: everything the app keeps OUTSIDE its database. The database, the media,
 * the saved logins and the stores are the reset's own; this is the rest - the choices and records kept as small
 * entries on the device (what was accepted, drafts, recent icons, which messages were seen, the music switch, which
 * groups of the menu are open, the payment warnings) and the files downloaded or rendered on the side (the CJK font
 * pack, the song renderings).
 *
 * Without it a "reset" came back with both legal texts already accepted and half-written drafts of stories that no
 * longer exist.
 */

/**
 * The admin panel, when this app is served by a server together with it, keeps its own entries in the same browser
 * storage under this prefix. They are not the app's to wipe.
 */
const FOREIGN_PREFIX = 'keres_admin_';

/** Removes every entry the app wrote, and nothing that is not its own. */
export async function clearLocalPreferences(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const ours = keys.filter((key) => !key.startsWith(FOREIGN_PREFIX));
  if (ours.length > 0) await AsyncStorage.multiRemove(ours);
}

/** Removes what was downloaded or rendered on the side. Each part on its own: one that cannot go does not hold the rest. */
export async function clearDownloadedFiles(): Promise<void> {
  await deleteCjkPack().catch((error: unknown) => {
    console.log('Reset: could not remove the CJK font pack.', error);
  });
  await defaultSongAudioStore()
    .prune(0)
    .catch((error: unknown) => {
      console.log('Reset: could not remove the song renderings.', error);
    });
}

/** All of it. A failure to forget a preference is not worth failing the reset over, but it is said. */
export async function clearEverythingOutsideDatabase(): Promise<void> {
  await clearLocalPreferences().catch((error: unknown) => {
    console.log('Reset: could not clear the stored preferences.', error);
  });
  await clearDownloadedFiles();
}

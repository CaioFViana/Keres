import { DEFAULT_SONG_PRINT, type SongPrint } from '@keres/shared';
import type { ManuscriptExportSettings } from './manuscriptExportSettings';

/**
 * How the export prints songs, from what the export screen collected; `undefined` when it prints
 * none. A script puts a song where it is sung, so asking it for an appendix means nothing there.
 */
export function songPrintOf(
  settings: ManuscriptExportSettings,
  heading: string,
  script = false,
): SongPrint | undefined {
  if (!settings.includeSongs) return undefined;
  return {
    ...DEFAULT_SONG_PRINT,
    placement: script ? 'after-scene' : settings.songsPlacement,
    language: settings.songLanguage,
    repeat: settings.songRepeat,
    chords: script ? false : settings.songChords,
    heading,
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = '@keres/music-tools';

interface MusicToolsState {
  /** Whether the music tools of a song - chords, the sheet, accompaniment, MIDI and ChordPro files - are shown. */
  enabled: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  reset: () => void;
}

let hydration: Promise<void> | null = null;

/**
 * Whether the person writes music for musicians. Off, a song is its words, with a tune to hear if they want
 * one; on, the lead sheet and everything around it is there too. Kept on this device only, like the other
 * choices about what the app shows; a corrupt or unreachable record reads as off.
 */
export const useMusicToolsStore = create<MusicToolsState>((set) => ({
  enabled: false,

  hydrate: () => {
    hydration ??= (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw === 'true') set({ enabled: true });
      } catch {
        // Off is the safe reading.
      }
    })();
    return hydration;
  },

  setEnabled: (enabled) => {
    set({ enabled });
    AsyncStorage.setItem(STORAGE_KEY, String(enabled)).catch(() => {
      // The choice lasts for this session even when it cannot be kept.
    });
  },

  reset: () => {
    hydration = null;
    set({ enabled: false });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));

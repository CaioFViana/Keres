import { create } from 'zustand';
import type { AppDrizzleClient } from '../db';
import { getClientSettings, updateClientSettings } from '../services/ClientSettingsService';

/** Durable dark-mode flag: every change writes through to `client_settings` first. */
interface ThemeState {
  darkMode: boolean;
  initializeTheme: (db: AppDrizzleClient) => Promise<void>;
  /**
   * Shows the other theme without saving anything: for the first run, where there is no
   * `client_settings` row to write to yet. The choice is saved with the profile it ends up in.
   */
  previewDarkMode: (darkMode: boolean) => void;
  setDarkMode: (db: AppDrizzleClient, darkMode: boolean) => Promise<void>;
  toggleDarkMode: (db: AppDrizzleClient) => Promise<void>;
  resetTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  darkMode: false,

  initializeTheme: async (db: AppDrizzleClient) => {
    const settings = await getClientSettings(db);
    if (settings) {
      set({ darkMode: settings.darkMode });
    }
  },

  previewDarkMode: (darkMode: boolean) => {
    set({ darkMode });
  },

  setDarkMode: async (db: AppDrizzleClient, darkMode: boolean) => {
    await updateClientSettings(db, { darkMode });
    set({ darkMode });
  },

  toggleDarkMode: async (db: AppDrizzleClient) => {
    const currentDarkMode = get().darkMode;
    await updateClientSettings(db, { darkMode: !currentDarkMode });
    set({ darkMode: !currentDarkMode });
  },

  resetTheme: () => {
    set({ darkMode: false });
  },
}));

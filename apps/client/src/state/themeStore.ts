import { create } from 'zustand';
import { getClientSettings, updateClientSettings } from '../services/ClientSettingsService';
import { AppDrizzleClient } from '../db';

interface ThemeState {
  darkMode: boolean;
  initializeTheme: (db: AppDrizzleClient) => Promise<void>;
  setDarkMode: (db: AppDrizzleClient, darkMode: boolean) => Promise<void>;
  toggleDarkMode: (db: AppDrizzleClient) => Promise<void>;
  resetTheme: () => void; // Add resetTheme to the interface
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  darkMode: false, // Default to light mode

  initializeTheme: async (db: AppDrizzleClient) => {
    const settings = await getClientSettings(db);
    if (settings) {
      set({ darkMode: settings.darkMode });
    }
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
    set({ darkMode: false }); // Reset to default light mode
  },
}));
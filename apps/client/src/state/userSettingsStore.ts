import { create } from 'zustand';
import { getClientSettings, updateClientSettings } from '../services/ClientSettingsService';
import { AppDrizzleClient } from '../db';

interface UserSettingsState {
  username: string | null;
  language: string | null;
  initializeSettings: (db: AppDrizzleClient) => Promise<void>;
  setUsername: (db: AppDrizzleClient, username: string) => Promise<void>;
  setLanguage: (db: AppDrizzleClient, language: string) => Promise<void>;
}

export const useUserSettingsStore = create<UserSettingsState>((set) => ({
  username: null,
  language: null,

  initializeSettings: async (db: AppDrizzleClient) => {
    const settings = await getClientSettings(db);
    if (settings) {
      set({ username: settings.localUsername, language: settings.language });
    }
  },

  setUsername: async (db: AppDrizzleClient, username: string) => {
    await updateClientSettings(db, { localUsername: username });
    set({ username });
  },

  setLanguage: async (db: AppDrizzleClient, language: string) => {
    await updateClientSettings(db, { language });
    set({ language });
  },
}));
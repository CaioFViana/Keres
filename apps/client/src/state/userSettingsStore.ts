import { create } from 'zustand';
import { getClientSettings, updateClientSettings } from '../services/ClientSettingsService';
import { AppDrizzleClient } from '../db';
import { ClientSettings } from '@keres/shared/entities/ClientSettings'; // Import ClientSettings

interface UserSettingsState {
  username: string | null;
  language: string | null;
  initializeSettings: (db: AppDrizzleClient) => Promise<ClientSettings | null>; // Change return type
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
    return settings; // Return the settings object
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
import { create } from 'zustand';
import { getClientSettings, updateClientSettings } from '../services/ClientSettingsService';
import { AppDrizzleClient } from '../db';
import { ClientSettings } from '@keres/shared/entities/ClientSettings'; // Import ClientSettings

interface UserSettingsState {
  userId: string | null; // Add userId to state
  username: string | null;
  language: string | null;
  initializeSettings: (db: AppDrizzleClient) => Promise<ClientSettings | null>; // Change return type
  setUsername: (db: AppDrizzleClient, username: string) => Promise<void>;
  setLanguage: (db: AppDrizzleClient, language: string) => Promise<void>;
  resetSettings: () => void;
}

export const useUserSettingsStore = create<UserSettingsState>((set) => ({
  userId: null, // Initialize userId
  username: null,
  language: null,

  initializeSettings: async (db: AppDrizzleClient) => {
    const settings = await getClientSettings(db);
    if (settings) {
      set({ userId: settings.id, username: settings.localUsername, language: settings.language }); // Set userId
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

  resetSettings: () => {
    set({ userId: null, username: null, language: null }); // Reset userId
  },
}));
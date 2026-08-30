import type { ClientSettings } from '@keres/shared/entities/ClientSettings'; // Import ClientSettings
import type { GregorianDateDisplayFormat } from '@keres/shared';
import { create } from 'zustand';
import type { AppDrizzleClient } from '../db';
import type { ServerSelect } from '../db/schema';
import { getClientSettings, updateClientSettings } from '../services/ClientSettingsService';

interface UserSettingsState {
  userId: string | null; // Add userId to state
  username: string | null;
  language: string | null;
  /** `true` = 24h, `false` = AM/PM. It applies to every time display/edit in the Date features. */
  use24HourTime: boolean;
  dateDisplayFormat: GregorianDateDisplayFormat;
  showContextualHelp: boolean;
  suggestLiteraryDevices: boolean;
  activeServer: ServerSelect | null;
  initializeSettings: (db: AppDrizzleClient) => Promise<ClientSettings | null>; // Change return type
  setUsername: (db: AppDrizzleClient, username: string) => Promise<void>;
  setLanguage: (db: AppDrizzleClient, language: string) => Promise<void>;
  setUse24HourTime: (db: AppDrizzleClient, use24HourTime: boolean) => Promise<void>;
  setDateDisplayFormat: (
    db: AppDrizzleClient,
    dateDisplayFormat: GregorianDateDisplayFormat,
  ) => Promise<void>;
  setShowContextualHelp: (db: AppDrizzleClient, showContextualHelp: boolean) => Promise<void>;
  setSuggestLiteraryDevices: (
    db: AppDrizzleClient,
    suggestLiteraryDevices: boolean,
  ) => Promise<void>;
  setActiveServer: (server: ServerSelect | null) => void;
  clearActiveServer: () => void;
  resetSettings: () => void;
}

export const useUserSettingsStore = create<UserSettingsState>((set) => ({
  userId: null, // Initialize userId
  username: null,
  language: null,
  use24HourTime: true,
  dateDisplayFormat: 'iso',
  showContextualHelp: true,
  suggestLiteraryDevices: true,
  activeServer: null,

  initializeSettings: async (db: AppDrizzleClient) => {
    const settings = await getClientSettings(db);
    if (settings) {
      set({
        userId: settings.id,
        username: settings.localUsername,
        language: settings.language,
        use24HourTime: settings.use24HourTime,
        dateDisplayFormat: settings.dateDisplayFormat ?? 'iso',
        showContextualHelp: settings.showContextualHelp,
        suggestLiteraryDevices: settings.suggestLiteraryDevices,
      }); // Set userId
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

  setUse24HourTime: async (db: AppDrizzleClient, use24HourTime: boolean) => {
    await updateClientSettings(db, { use24HourTime });
    set({ use24HourTime });
  },

  setDateDisplayFormat: async (
    db: AppDrizzleClient,
    dateDisplayFormat: GregorianDateDisplayFormat,
  ) => {
    await updateClientSettings(db, { dateDisplayFormat });
    set({ dateDisplayFormat });
  },

  setShowContextualHelp: async (db: AppDrizzleClient, showContextualHelp: boolean) => {
    await updateClientSettings(db, { showContextualHelp });
    set({ showContextualHelp });
  },

  setSuggestLiteraryDevices: async (db: AppDrizzleClient, suggestLiteraryDevices: boolean) => {
    await updateClientSettings(db, { suggestLiteraryDevices });
    set({ suggestLiteraryDevices });
  },

  setActiveServer: (server: ServerSelect | null) => {
    set({ activeServer: server });
  },

  clearActiveServer: () => {
    set({ activeServer: null });
  },

  resetSettings: () => {
    set({
      userId: null,
      username: null,
      language: null,
      use24HourTime: true,
      dateDisplayFormat: 'iso',
      showContextualHelp: true,
      suggestLiteraryDevices: true,
      activeServer: null,
    }); // Reset all settings including activeServer
  },
}));

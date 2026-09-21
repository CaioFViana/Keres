import type { ClientSettings, MapExportFormat } from '@keres/shared/entities/ClientSettings';
import type { GregorianDateDisplayFormat } from '@keres/shared';
import { create } from 'zustand';
import type { AppDrizzleClient } from '../db';
import type { ServerSelect } from '../db/schema';
import { getClientSettings, updateClientSettings } from '../services/ClientSettingsService';
import type { FirstStoryProgress, TutorialProgress } from '../utils/tutorialProgress';
import {
  defaultTutorialProgress,
  encodeTutorialProgress,
  parseTutorialProgress,
  withFirstStoryProgress,
  withTutorialSeen,
} from '../utils/tutorialProgress';

/**
 * Device-level settings, durable in the `client_settings` table.
 *
 * Unlike the entity stores (whose rows live in SQLite but whose filter state is
 * ephemeral), every setter here writes through to the database first and only then
 * updates Zustand, so a preference survives restarts. `initializeSettings` hydrates
 * the store once at startup; `activeServer` is the sole in-memory-only field.
 */
interface UserSettingsState {
  userId: string | null;
  username: string | null;
  language: string | null;
  /** `true` = 24h, `false` = AM/PM. It applies to every time display/edit in the Date features. */
  use24HourTime: boolean;
  dateDisplayFormat: GregorianDateDisplayFormat;
  showContextualHelp: boolean;
  suggestLiteraryDevices: boolean;
  exportFormat: MapExportFormat;
  showTutorials: boolean;
  tutorialProgress: TutorialProgress;
  activeServer: ServerSelect | null;
  initializeSettings: (db: AppDrizzleClient) => Promise<ClientSettings | null>;
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
  setExportFormat: (db: AppDrizzleClient, exportFormat: MapExportFormat) => Promise<void>;
  setShowTutorials: (db: AppDrizzleClient, showTutorials: boolean) => Promise<void>;
  /** Records a completed or skipped tour; already-seen ids write nothing. */
  markTutorialSeen: (db: AppDrizzleClient, screenId: string) => Promise<void>;
  /** Merges an update into the "first story" trail progress. */
  setFirstStoryProgress: (
    db: AppDrizzleClient,
    patch: Partial<FirstStoryProgress>,
  ) => Promise<void>;
  /** Clears the seen history and re-enables tours. */
  resetSeenTutorials: (db: AppDrizzleClient) => Promise<void>;
  setActiveServer: (server: ServerSelect | null) => void;
  clearActiveServer: () => void;
  resetSettings: () => void;
}

export const useUserSettingsStore = create<UserSettingsState>((set, get) => ({
  userId: null,
  username: null,
  language: null,
  use24HourTime: true,
  dateDisplayFormat: 'iso',
  showContextualHelp: true,
  suggestLiteraryDevices: true,
  exportFormat: 'svg',
  showTutorials: true,
  tutorialProgress: defaultTutorialProgress(),
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
        exportFormat: settings.exportFormat ?? 'svg',
        showTutorials: settings.showTutorials ?? true,
        tutorialProgress: parseTutorialProgress(settings.seenTutorials),
      });
    }
    return settings;
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

  setExportFormat: async (db: AppDrizzleClient, exportFormat: MapExportFormat) => {
    await updateClientSettings(db, { exportFormat });
    set({ exportFormat });
  },

  setShowTutorials: async (db: AppDrizzleClient, showTutorials: boolean) => {
    await updateClientSettings(db, { showTutorials });
    set({ showTutorials });
  },

  markTutorialSeen: async (db: AppDrizzleClient, screenId: string) => {
    const next = withTutorialSeen(get().tutorialProgress, screenId);
    if (next === get().tutorialProgress) return;
    await updateClientSettings(db, { seenTutorials: encodeTutorialProgress(next) });
    set({ tutorialProgress: next });
  },

  setFirstStoryProgress: async (db: AppDrizzleClient, patch: Partial<FirstStoryProgress>) => {
    const next = withFirstStoryProgress(get().tutorialProgress, patch);
    await updateClientSettings(db, { seenTutorials: encodeTutorialProgress(next) });
    set({ tutorialProgress: next });
  },

  resetSeenTutorials: async (db: AppDrizzleClient) => {
    const cleared = defaultTutorialProgress();
    await updateClientSettings(db, {
      showTutorials: true,
      seenTutorials: encodeTutorialProgress(cleared),
    });
    set({ showTutorials: true, tutorialProgress: cleared });
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
      exportFormat: 'svg',
      showTutorials: true,
      tutorialProgress: defaultTutorialProgress(),
      activeServer: null,
    });
  },
}));

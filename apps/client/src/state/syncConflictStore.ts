import { create } from 'zustand';
import type { AppDrizzleClient } from '../db';
import type { PendingConflict } from '../services/SyncConflictService';
import { createSyncConflictService } from '../services/SyncConflictService';

interface SyncConflictState {
  conflicts: PendingConflict[];
  /** The conflict opened in the field-diff drill-in. `null` when none is open. */
  selectedConflictId: string | null;
  isVisible: boolean;
  isResolving: boolean;
  refresh: (db: AppDrizzleClient, storyId?: string) => Promise<void>;
  open: () => void;
  close: () => void;
  selectConflict: (id: string) => void;
  clearSelection: () => void;
  keepLocal: (
    db: AppDrizzleClient,
    conflictId: string,
    chosenValues?: Record<string, any>,
  ) => Promise<void>;
  keepServer: (db: AppDrizzleClient, conflictId: string) => Promise<void>;
  dismiss: (db: AppDrizzleClient, conflictId: string) => Promise<void>;
  reset: () => void;
}

export const useSyncConflictStore = create<SyncConflictState>((set, get) => ({
  conflicts: [],
  selectedConflictId: null,
  isVisible: false,
  isResolving: false,

  reset: () =>
    set({
      conflicts: [],
      selectedConflictId: null,
      isVisible: false,
      isResolving: false,
    }),

  /**
   * It only reloads the list - it never opens the screen by itself. A conflict stalls that entity's
   * synchronization, but that does not justify interrupting what the user is doing right now; the entry
   * point (the banner on the Dashboard) is what decides when to show this.
   */
  refresh: async (db, storyId) => {
    try {
      const conflicts = await createSyncConflictService(db).getPendingConflicts(storyId);
      set({ conflicts });
    } catch (error) {
      console.log('useSyncConflictStore: failed to load pending conflicts.', error);
    }
  },

  open: () => set({ isVisible: true }),

  close: () => set({ isVisible: false, selectedConflictId: null }),

  selectConflict: (id) => set({ selectedConflictId: id }),

  clearSelection: () => set({ selectedConflictId: null }),

  keepLocal: async (db, conflictId, chosenValues) => {
    set({ isResolving: true });
    try {
      await createSyncConflictService(db).resolveKeepLocal(conflictId, chosenValues);
    } catch (error) {
      console.log('useSyncConflictStore: failed to keep local values.', error);
    } finally {
      set((state) => ({
        isResolving: false,
        selectedConflictId:
          state.selectedConflictId === conflictId ? null : state.selectedConflictId,
      }));
      await get().refresh(db);
    }
  },

  keepServer: async (db, conflictId) => {
    set({ isResolving: true });
    try {
      await createSyncConflictService(db).resolveKeepServer(conflictId);
    } catch (error) {
      console.log('useSyncConflictStore: failed to keep server values.', error);
    } finally {
      set((state) => ({
        isResolving: false,
        selectedConflictId:
          state.selectedConflictId === conflictId ? null : state.selectedConflictId,
      }));
      await get().refresh(db);
    }
  },

  dismiss: async (db, conflictId) => {
    try {
      await createSyncConflictService(db).dismissConflict(conflictId);
    } catch (error) {
      console.log('useSyncConflictStore: failed to dismiss conflict.', error);
    } finally {
      set((state) => ({
        selectedConflictId:
          state.selectedConflictId === conflictId ? null : state.selectedConflictId,
      }));
      await get().refresh(db);
    }
  },
}));

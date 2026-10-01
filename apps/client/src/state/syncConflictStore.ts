import { create } from 'zustand';
import type { AppDrizzleClient } from '../db';
import type { PendingConflict } from '../services/SyncConflictService';
import { createSyncConflictService } from '../services/SyncConflictService';

interface SyncConflictState {
  conflicts: PendingConflict[];
  /** The conflict opened in the field-diff drill-in. `null` when none is open. */
  selectedConflictId: string | null;
  isResolving: boolean;
  /** Story scope the loaded list was read with; reloads after an action preserve it. */
  lastScope: string | undefined;
  refresh: (db: AppDrizzleClient, storyId?: string) => Promise<void>;
  selectConflict: (id: string) => void;
  clearSelection: () => void;
  keepLocal: (
    db: AppDrizzleClient,
    conflictId: string,
    chosenValues?: Record<string, any>,
  ) => Promise<void>;
  keepServer: (db: AppDrizzleClient, conflictId: string) => Promise<void>;
  keepServerAndCloneBoard: (
    db: AppDrizzleClient,
    conflictId: string,
    currentUserId: string,
    cloneName: string,
  ) => Promise<void>;
  dismiss: (db: AppDrizzleClient, conflictId: string) => Promise<void>;
  reset: () => void;
}

// Refreshes overlap in practice (a resolve lands while a sync event fires another): without a
// generation the slower one wins and the list shows a stale scope. `reset` also invalidates,
// so an in-flight load cannot repopulate a cleared store.
let refreshGeneration = 0;

export const useSyncConflictStore = create<SyncConflictState>((set, get) => ({
  conflicts: [],
  selectedConflictId: null,
  isResolving: false,
  lastScope: undefined,

  reset: () => {
    refreshGeneration += 1;
    set({
      conflicts: [],
      selectedConflictId: null,
      isResolving: false,
      lastScope: undefined,
    });
  },

  /**
   * It only reloads the list - it never opens the screen by itself. A conflict stalls that entity's
   * synchronization, but that does not justify interrupting what the user is doing right now; the entry
   * point (the banner on the Dashboard) is what decides when to show this.
   */
  refresh: async (db, storyId) => {
    const generation = ++refreshGeneration;
    try {
      const conflicts = await createSyncConflictService(db).getPendingConflicts(storyId);
      if (generation !== refreshGeneration) return;
      set({ conflicts, lastScope: storyId });
    } catch (error) {
      console.log('useSyncConflictStore: failed to load pending conflicts.', error);
    }
  },

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
      // Preserve the loaded scope: an unscoped reload would flood the list (and the banner
      // count) with other stories' conflicts.
      await get().refresh(db, get().lastScope);
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
      await get().refresh(db, get().lastScope);
    }
  },

  keepServerAndCloneBoard: async (db, conflictId, currentUserId, cloneName) => {
    set({ isResolving: true });
    try {
      await createSyncConflictService(db).resolveKeepServerAndCloneBoard(
        conflictId,
        currentUserId,
        cloneName,
      );
    } catch (error) {
      console.log('useSyncConflictStore: failed to clone the local board.', error);
    } finally {
      set((state) => ({
        isResolving: false,
        selectedConflictId:
          state.selectedConflictId === conflictId ? null : state.selectedConflictId,
      }));
      await get().refresh(db, get().lastScope);
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
      await get().refresh(db, get().lastScope);
    }
  },
}));

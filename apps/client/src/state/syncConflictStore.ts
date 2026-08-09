import { create } from 'zustand';
import { AppDrizzleClient } from '../db';
import { createSyncConflictService, PendingConflict } from '../services/SyncConflictService';

interface SyncConflictState {
  conflicts: PendingConflict[];
  /** Índice do conflito aberto na tela de resolução. */
  activeIndex: number;
  isVisible: boolean;
  isResolving: boolean;
  /**
   * Conflitos que o usuário já fechou sem resolver, nesta sessão.
   *
   * A tela se abre sozinha quando um conflito aparece - é uma decisão que trava a
   * sincronização daquela entidade, então deixá-la só num canto esconderia trabalho
   * parado. Mas reabrir a cada ciclo de 30 segundos algo que a pessoa acabou de fechar
   * seria hostil, então cada conflito só se impõe uma vez; conflitos novos voltam a abrir.
   */
  postponedConflictIds: string[];
  refresh: (db: AppDrizzleClient, storyId?: string) => Promise<void>;
  open: (index?: number) => void;
  close: () => void;
  setActiveIndex: (index: number) => void;
  keepLocal: (db: AppDrizzleClient, conflictId: string, chosenValues?: Record<string, any>) => Promise<void>;
  keepServer: (db: AppDrizzleClient, conflictId: string) => Promise<void>;
  dismiss: (db: AppDrizzleClient, conflictId: string) => Promise<void>;
  reset: () => void;
}

export const useSyncConflictStore = create<SyncConflictState>((set, get) => ({
  conflicts: [],
  activeIndex: 0,
  isVisible: false,
  isResolving: false,
  postponedConflictIds: [],

  reset: () => set({
    conflicts: [],
    activeIndex: 0,
    isVisible: false,
    isResolving: false,
    postponedConflictIds: [],
  }),

  refresh: async (db, storyId) => {
    try {
      const conflicts = await createSyncConflictService(db).getPendingConflicts(storyId);
      set((state) => {
        const hasUnseenConflict = conflicts.some(conflict => !state.postponedConflictIds.includes(conflict.id));
        return {
          conflicts,
          activeIndex: Math.min(state.activeIndex, Math.max(conflicts.length - 1, 0)),
          isVisible: conflicts.length === 0 ? false : state.isVisible || hasUnseenConflict,
        };
      });
    } catch (error) {
      console.log('useSyncConflictStore: failed to load pending conflicts.', error);
    }
  },

  open: (index = 0) => set({ isVisible: true, activeIndex: index }),

  close: () => set((state) => ({
    isVisible: false,
    postponedConflictIds: Array.from(new Set([
      ...state.postponedConflictIds,
      ...state.conflicts.map(conflict => conflict.id),
    ])),
  })),

  setActiveIndex: (index) => set({ activeIndex: index }),

  keepLocal: async (db, conflictId, chosenValues) => {
    set({ isResolving: true });
    try {
      await createSyncConflictService(db).resolveKeepLocal(conflictId, chosenValues);
    } catch (error) {
      console.log('useSyncConflictStore: failed to keep local values.', error);
    } finally {
      set({ isResolving: false });
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
      set({ isResolving: false });
      await get().refresh(db);
    }
  },

  dismiss: async (db, conflictId) => {
    try {
      await createSyncConflictService(db).dismissConflict(conflictId);
    } catch (error) {
      console.log('useSyncConflictStore: failed to dismiss conflict.', error);
    } finally {
      await get().refresh(db);
    }
  },
}));

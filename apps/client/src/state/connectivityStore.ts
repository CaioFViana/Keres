import { create } from 'zustand';
import i18n from '../utils/i18n';
import { useNotificationStore } from './notificationStore';

export type ServerReachability = 'unknown' | 'online' | 'offline';

interface ConnectivityState {
  statusByServerId: Record<string, ServerReachability>;
  /** Record a successful exchange with a server. Announces only a recovery (offline -> online). */
  reportReachable: (serverId: string, serverName?: string | null) => void;
  /** Record an unreachable server. Announces only the first transition into offline. */
  reportUnreachable: (serverId: string, serverName?: string | null) => void;
  isOffline: (serverId: string) => boolean;
  reset: () => void;
}

const label = (key: string, serverName?: string | null) =>
  serverName ? `${i18n.t(key)}: ${serverName}` : i18n.t(key);

/**
 * Tracks whether each server is currently reachable, so the app can tell the user about
 * *changes* in connectivity rather than repeating the same failure every sync cycle.
 *
 * Sync runs on a timer, so a server that is down produces a failure every single cycle.
 * Notifying on each one buries the user in duplicates; notifying on none leaves them
 * wondering why nothing saves. Reporting only on transitions gives exactly two messages:
 * one when the connection drops, one when it comes back.
 */
export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  statusByServerId: {},

  reset: () => set({ statusByServerId: {} }),

  reportReachable: (serverId, serverName) => {
    const previous = get().statusByServerId[serverId] ?? 'unknown';
    if (previous === 'online') {
      return;
    }

    set((state) => ({
      statusByServerId: { ...state.statusByServerId, [serverId]: 'online' },
    }));

    // Only announce an actual recovery. Reaching a server for the first time after
    // startup ('unknown' -> 'online') is the expected case and needs no message.
    if (previous === 'offline') {
      useNotificationStore.getState().showNotification(label('server_reconnected', serverName), 'success');
    }
  },

  reportUnreachable: (serverId, serverName) => {
    const previous = get().statusByServerId[serverId] ?? 'unknown';
    if (previous === 'offline') {
      return; // Already told the user; stay quiet until something changes.
    }

    set((state) => ({
      statusByServerId: { ...state.statusByServerId, [serverId]: 'offline' },
    }));

    useNotificationStore.getState().showNotification(label('server_unreachable', serverName), 'warning');
  },

  isOffline: (serverId) => get().statusByServerId[serverId] === 'offline',
}));

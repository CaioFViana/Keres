import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = '@keres/messages-seen';

/** The conversation's last message, as the server's inbox reports it. */
export interface ObservedConversation {
  key: string;
  lastMessageId: string;
  /** Written by this user: a conversation they last spoke in has nothing new for them. */
  mine: boolean;
}

interface Persisted {
  /** The newest message of each conversation that this user has seen. */
  seen: Record<string, string>;
  /** Servers whose messages already on them were taken as seen the first time they were looked at. */
  baselined: string[];
}

interface UnseenMessagesState {
  /** Conversations with a message from the other side that was not opened yet: key → that message's id. */
  unseen: Record<string, string>;
  seen: Record<string, string>;
  baselined: string[];
  /** Reads what was kept from earlier runs. Safe to call more than once. */
  hydrate: () => Promise<void>;
  /** What one server's inbox says now. Messages already there the first time are taken as seen. */
  observe: (serverId: string, conversations: ObservedConversation[]) => Promise<void>;
  /** The user opened (or wrote in) the conversation: everything up to `messageId` is seen. */
  markSeen: (key: string, messageId: string) => void;
  /** Forgets what is unseen on servers that are no longer registered. */
  retainServers: (serverIds: string[]) => void;
  reset: () => void;
}

let hydration: Promise<void> | null = null;

const persist = (state: Persisted) => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
    // The marks are a convenience: losing a write only brings a badge back.
  });
};

/**
 * What the user has not seen yet in their conversations - kept on this device only. The server never
 * learns whether a message was read (that is the administrators' business, and only for what is
 * addressed to them); this exists so a notification that was missed still leaves a trace in the menu.
 */
export const useUnseenMessagesStore = create<UnseenMessagesState>((set, get) => ({
  unseen: {},
  seen: {},
  baselined: [],

  hydrate: () => {
    hydration ??= (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<Persisted>;
        set({
          seen: parsed.seen && typeof parsed.seen === 'object' ? parsed.seen : {},
          baselined: Array.isArray(parsed.baselined) ? parsed.baselined : [],
        });
      } catch {
        // A corrupt entry reads as empty.
      }
    })();
    return hydration;
  },

  observe: async (serverId, conversations) => {
    await get().hydrate();
    const { seen, baselined } = get();
    const firstLook = !baselined.includes(serverId);
    const nextSeen = { ...seen };
    const nextUnseen: Record<string, string> = {};
    const prefix = `${serverId}|`;
    // What this server no longer reports (a cleared conversation) is no longer unseen either.
    for (const [key, id] of Object.entries(get().unseen)) {
      if (!key.startsWith(prefix)) nextUnseen[key] = id;
    }
    for (const { key, lastMessageId, mine } of conversations) {
      if (firstLook || mine) {
        nextSeen[key] = lastMessageId;
      } else if ((nextSeen[key] ?? '') < lastMessageId) {
        nextUnseen[key] = lastMessageId;
      }
    }
    const nextBaselined = firstLook ? [...baselined, serverId] : baselined;
    set({ unseen: nextUnseen, seen: nextSeen, baselined: nextBaselined });
    persist({ seen: nextSeen, baselined: nextBaselined });
  },

  markSeen: (key, messageId) => {
    const { seen, unseen, baselined } = get();
    const nextSeen = (seen[key] ?? '') < messageId ? { ...seen, [key]: messageId } : seen;
    const unseenId = unseen[key];
    const nextUnseen =
      unseenId !== undefined && unseenId <= messageId
        ? Object.fromEntries(Object.entries(unseen).filter(([otherKey]) => otherKey !== key))
        : unseen;
    if (nextSeen === seen && nextUnseen === unseen) return;
    set({ seen: nextSeen, unseen: nextUnseen });
    persist({ seen: nextSeen, baselined });
  },

  retainServers: (serverIds) => {
    const { unseen } = get();
    const kept = Object.entries(unseen).filter(([key]) =>
      serverIds.some((serverId) => key.startsWith(`${serverId}|`)),
    );
    if (kept.length !== Object.keys(unseen).length) set({ unseen: Object.fromEntries(kept) });
  },

  reset: () => {
    hydration = null;
    set({ unseen: {}, seen: {}, baselined: [] });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));

/** Whether any conversation has a message the user has not opened. */
export const useHasUnseenMessages = (): boolean =>
  useUnseenMessagesStore((state) => Object.keys(state.unseen).length > 0);

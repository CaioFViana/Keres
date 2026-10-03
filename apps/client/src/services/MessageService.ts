import type { ChatMessage, MessageLimits, MessagePage } from '@keres/shared';
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import type { AppDrizzleClient } from '../db';
import type { ServerSelect } from '../db/schema';
import { useNotificationStore } from '../state/notificationStore';
import { useUnseenMessagesStore } from '../state/unseenMessagesStore';
import { conversationKey } from '../utils/conversationKey';
import { entityEventEmitter } from '../utils/EventEmitter';
import i18n from '../utils/i18n';
import { isOfflineError } from './apiClient';
import { createFriendshipService } from './FriendshipService';
import { messageApi, type MessagePeerRef } from './MessageApiService';
import { createServerService } from './ServerService';

export type { MessagePeerRef };

/** Announced when the conversations on some server may have changed: lists reread what they show. */
export const MESSAGES_CHANGED = 'messages_changed';

/** Someone a message can go to on one server: its administrators, or a friend there. */
export interface MessageContact {
  serverId: string;
  serverName: string;
  kind: 'admin' | 'direct';
  /** The friend's id on that server; `null` for the administrators. */
  userId: string | null;
  /** The friend's username; empty for the administrators (the screen words them itself). */
  name: string;
  tag: string | null;
  avatarColor: string | null;
  avatarIcon: string | null;
}

export interface InboxEntry extends MessageContact {
  lastMessage: ChatMessage;
}

export interface Inbox {
  entries: InboxEntry[];
  /** Servers that did not answer: their conversations are missing from `entries`, not gone. */
  unreachableServerIds: string[];
}

export const createMessageService = (db: AppDrizzleClient) => new MessageService(db);

export { conversationKey };

/**
 * What the conversation open on screen is (if any), so a message that arrives in it is not also
 * announced as a notification on top of it.
 */
let openConversationKey: string | null = null;
export function setOpenConversation(key: string | null): void {
  openConversationKey = key;
}

/** Last message seen per conversation, and the servers whose first look has been taken. */
const lastSeenMessage = new Map<string, string>();

type ServerConversation = {
  kind: 'admin' | 'direct';
  peerUserId: string | null;
  lastMessage: ChatMessage;
};

const peerOf = (conversation: ServerConversation): MessagePeerRef =>
  conversation.kind === 'admin'
    ? { kind: 'admin' }
    : { kind: 'direct', userId: conversation.peerUserId ?? '' };

/**
 * Tells the unseen-messages store what a server's inbox says. The conversation on screen counts as
 * seen: its messages are being read as they arrive.
 */
function observeConversations(
  serverId: string,
  conversations: ServerConversation[],
): Promise<void> {
  return useUnseenMessagesStore.getState().observe(
    serverId,
    conversations.map((conversation) => {
      const key = conversationKey(serverId, peerOf(conversation));
      return {
        key,
        lastMessageId: conversation.lastMessage.id,
        mine: conversation.lastMessage.mine || key === openConversationKey,
      };
    }),
  );
}
const seededServers = new Set<string>();

/**
 * Messages are not kept on the device: the server is the only copy, so there is no cache to keep in
 * step and nothing to migrate - every screen reads what it shows over REST, and the realtime nudge
 * (`messages.changed`) only says when to read again. Without a connection the lists are unavailable
 * (and say so) instead of showing something stale.
 */
export class MessageService {
  constructor(private readonly db: AppDrizzleClient) {}

  private async serverOrThrow(serverId: string): Promise<ServerSelect> {
    const server = await createServerService(this.db).getServerById(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found.`);
    }
    return server;
  }

  /**
   * Everybody the user can write to: the administrators of each registered server, and the friends
   * on each (the API refuses anybody else).
   */
  async getContacts(): Promise<MessageContact[]> {
    const [servers, friendships] = await Promise.all([
      createServerService(this.db).getAllServers(),
      createFriendshipService(this.db).getAllFriendships(),
    ]);
    const contacts: MessageContact[] = [];
    for (const server of servers) {
      contacts.push({
        serverId: server.id,
        serverName: server.name,
        kind: 'admin',
        userId: null,
        name: '',
        tag: null,
        avatarColor: null,
        avatarIcon: null,
      });
    }
    for (const friendship of friendships) {
      if (friendship.status !== FriendStatus.FRIEND) continue;
      contacts.push({
        serverId: friendship.serverId,
        serverName: friendship.serverName ?? friendship.serverId,
        kind: 'direct',
        userId: friendship.otherUserId,
        name: friendship.friendUsername,
        tag: friendship.otherUserTag,
        avatarColor: friendship.otherUserAvatarColor,
        avatarIcon: friendship.otherUserAvatarIcon,
      });
    }
    return contacts;
  }

  /** One line per conversation over every server, newest first. */
  async getInbox(): Promise<Inbox> {
    const [servers, contacts] = await Promise.all([
      createServerService(this.db).getAllServers(),
      this.getContacts(),
    ]);
    const entries: InboxEntry[] = [];
    const unreachableServerIds: string[] = [];
    await Promise.all(
      servers.map(async (server) => {
        try {
          const conversations = await messageApi.getConversations(server);
          await observeConversations(server.id, conversations);
          for (const conversation of conversations) {
            const contact = contacts.find(
              (candidate) =>
                candidate.serverId === server.id &&
                candidate.kind === conversation.kind &&
                candidate.userId === conversation.peerUserId,
            );
            if (contact) {
              entries.push({ ...contact, lastMessage: conversation.lastMessage });
            }
          }
        } catch (error) {
          if (!isOfflineError(error)) {
            console.warn(`Could not read the messages of ${server.name}:`, error);
          }
          unreachableServerIds.push(server.id);
        }
      }),
    );
    // A server that is gone leaves nothing unseen behind.
    useUnseenMessagesStore.getState().retainServers(servers.map((server) => server.id));
    entries.sort((a, b) => b.lastMessage.id.localeCompare(a.lastMessage.id));
    return { entries, unreachableServerIds };
  }

  async getMessages(serverId: string, peer: MessagePeerRef, before?: string): Promise<MessagePage> {
    return messageApi.getMessages(await this.serverOrThrow(serverId), peer, before);
  }

  async getLimits(serverId: string): Promise<MessageLimits> {
    return messageApi.getLimits(await this.serverOrThrow(serverId));
  }

  async send(serverId: string, peer: MessagePeerRef, body: string): Promise<ChatMessage> {
    const sent = await messageApi.send(await this.serverOrThrow(serverId), peer, body);
    // What this user just wrote is not news to them: it must not be announced when the server nudges.
    lastSeenMessage.set(conversationKey(serverId, peer), sent.id);
    entityEventEmitter.emit(MESSAGES_CHANGED, serverId);
    return sent;
  }

  async deleteMessage(serverId: string, messageId: string): Promise<void> {
    await messageApi.deleteMessage(await this.serverOrThrow(serverId), messageId);
    entityEventEmitter.emit(MESSAGES_CHANGED, serverId);
  }

  async clearConversation(serverId: string, peer: MessagePeerRef): Promise<void> {
    await messageApi.clearConversation(await this.serverOrThrow(serverId), peer);
    entityEventEmitter.emit(MESSAGES_CHANGED, serverId);
  }

  /**
   * The server nudged (or the socket just connected): tell lists to reread, and announce what arrived
   * since the last look. The first look at a server only takes note - what was already there is not
   * news - and a message in the conversation on screen is shown there, not as a notification.
   */
  async handleServerNudge(server: ServerSelect): Promise<void> {
    entityEventEmitter.emit(MESSAGES_CHANGED, server.id);
    let conversations;
    try {
      conversations = await messageApi.getConversations(server);
    } catch (error) {
      if (!isOfflineError(error)) {
        console.warn(`Could not read the messages of ${server.name}:`, error);
      }
      return;
    }
    await observeConversations(server.id, conversations);
    const firstLook = !seededServers.has(server.id);
    seededServers.add(server.id);
    const contacts = firstLook ? [] : await this.getContacts();
    const { showNotification } = useNotificationStore.getState();
    for (const conversation of conversations) {
      const key = conversationKey(server.id, peerOf(conversation));
      const previous = lastSeenMessage.get(key);
      lastSeenMessage.set(key, conversation.lastMessage.id);
      if (firstLook || previous === conversation.lastMessage.id) continue;
      if (conversation.lastMessage.mine || key === openConversationKey) continue;
      const name =
        conversation.kind === 'admin'
          ? i18n.t('messages_administrators')
          : (contacts.find((c) => c.serverId === server.id && c.userId === conversation.peerUserId)
              ?.name ?? '');
      showNotification(i18n.t('message_received', { name }), 'info');
    }
  }
}

/** For tests: forget what was seen. */
export function resetMessageNudgeState(): void {
  lastSeenMessage.clear();
  seededServers.clear();
  openConversationKey = null;
}

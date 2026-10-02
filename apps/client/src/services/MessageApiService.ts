import type { ChatMessage, ConversationSummary, MessageLimits, MessagePage } from '@keres/shared';
import type { ServerSelect } from '../db/schemas/servers';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';

/** Who a conversation is with: the server's administrators, or one friend (by their id on that server). */
export type MessagePeerRef = { kind: 'admin' } | { kind: 'direct'; userId: string };

/** The conversation's address on the server: `/messages/admin` or `/messages/user/:id`. */
const peerPath = (peer: MessagePeerRef) =>
  peer.kind === 'admin' ? '/messages/admin' : `/messages/user/${encodeURIComponent(peer.userId)}`;

export class MessageApiService {
  // Messages live on one server each, and the shared `apiClient` singleton only points at one at a
  // time - the same reason `FriendshipApiService` builds a client bound to the target server.
  private clientFor(server: ServerSelect) {
    const client = createKeresAxiosInstance({ baseURL: server.url });
    client.setTokenProvider(authTokenManager);
    client.setActiveServer(server);
    return client;
  }

  async getConversations(server: ServerSelect): Promise<ConversationSummary[]> {
    const response = await this.clientFor(server).get('/messages/conversations');
    return response.data;
  }

  async getLimits(server: ServerSelect): Promise<MessageLimits> {
    const response = await this.clientFor(server).get('/messages/limits');
    return response.data;
  }

  /** Newest first; `before` is the cursor of the page after the last one received. */
  async getMessages(
    server: ServerSelect,
    peer: MessagePeerRef,
    before?: string,
  ): Promise<MessagePage> {
    const response = await this.clientFor(server).get(peerPath(peer), {
      params: before ? { before } : undefined,
    });
    return response.data;
  }

  async send(server: ServerSelect, peer: MessagePeerRef, body: string): Promise<ChatMessage> {
    const response = await this.clientFor(server).post(peerPath(peer), { body });
    return response.data;
  }

  async deleteMessage(server: ServerSelect, messageId: string): Promise<void> {
    await this.clientFor(server).delete(`/messages/${encodeURIComponent(messageId)}`);
  }

  async clearConversation(server: ServerSelect, peer: MessagePeerRef): Promise<void> {
    await this.clientFor(server).delete(peerPath(peer));
  }
}

export const messageApi = new MessageApiService();

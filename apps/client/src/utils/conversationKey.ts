/** Who a conversation is with: the server's administrators, or one friend (by their id on that server). */
export type ConversationPeer = { kind: 'admin' } | { kind: 'direct'; userId: string };

/** A conversation's identity across servers, as a string: `serverId|admin` or `serverId|userId`. */
export const conversationKey = (serverId: string, peer: ConversationPeer) =>
  `${serverId}|${peer.kind === 'admin' ? 'admin' : peer.userId}`;

/** The conversation with a server's administrators. */
export const adminConversationKey = (serverId: string) =>
  conversationKey(serverId, { kind: 'admin' });

/** The conversation with one friend on a server. */
export const directConversationKey = (serverId: string, userId: string) =>
  conversationKey(serverId, { kind: 'direct', userId });

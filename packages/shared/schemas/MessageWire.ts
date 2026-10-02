import type { MessageChannel } from '../metadata/MessageLimits';

/**
 * One message of a conversation as the user who reads it sees it. Dates are ISO strings: this is the
 * wire shape, like `EnrichedFriendship`.
 */
export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  /** Written by the reader (or, in the admin conversation, by the reader's side) - not the other party. */
  mine: boolean;
}

/** One line of the inbox: a conversation with a friend, or with the administrators. */
export interface ConversationSummary {
  kind: 'admin' | 'direct';
  /** The friend's id on this server; `null` for the administrators. */
  peerUserId: string | null;
  lastMessage: ChatMessage;
}

/** What a user may still send today. `limit` is `null` when the plan has no ceiling. */
export interface MessageLimits {
  direct: { limit: number | null; used: number };
  admin: { limit: number; used: number };
}

/** The user behind a message, as the administrators see them. */
export interface AdminMessageSender {
  id: string;
  username: string;
  tag: string;
  isDeleted: boolean;
}

/** A message as the admin panel lists it: only what was addressed to the administrators, or their replies. */
export interface AdminMessage {
  id: string;
  channel: Extract<MessageChannel, 'site' | 'admin'>;
  /** `true` for a reply an administrator wrote; `false` for what arrived. */
  fromAdmin: boolean;
  /** Present on messages from the site form only. */
  subject: string | null;
  body: string;
  /** Present on messages from the site form only. */
  contactEmail: string | null;
  /** The registered user who wrote it (or to whom the reply went); `null` for the site form. */
  user: AdminMessageSender | null;
  createdAt: string;
  isRead: boolean;
  isArchived: boolean;
}

/** A message opened in the admin panel, with the rest of the conversation with that user. */
export interface AdminMessageDetail {
  message: AdminMessage;
  /** Oldest first. Empty for a message from the site form. */
  thread: AdminMessage[];
}

export interface AdminMessagePage {
  items: AdminMessage[];
  total: number;
  page: number;
  pageSize: number;
}

/** A page of a conversation, newest first; `nextBefore` is the cursor for the page after it, `null` at the end. */
export interface MessagePage {
  items: ChatMessage[];
  nextBefore: string | null;
}

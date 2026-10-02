import type { ChatMessage, MessageLimits } from '@keres/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import { isOfflineError } from '../services/apiClient';
import {
  conversationKey,
  createMessageService,
  type MessagePeerRef,
  MESSAGES_CHANGED,
  setOpenConversation,
} from '../services/MessageService';
import { useNotificationStore } from '../state/notificationStore';
import { useUnseenMessagesStore } from '../state/unseenMessagesStore';
import { AppAlert } from '../utils/AppAlert';
import { useEntityEventSubscriptions, useEntityInitialLoad } from './useEntityRefreshLifecycle';

/** The HTTP status of a failed call, which the client's axios wrapper keeps on `response`. */
const statusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status;

/**
 * One conversation: the messages (newest first, a page at a time), what the user may still send
 * today, and sending / deleting / clearing. Reads again when the server says messages changed, and
 * tells the realtime service which conversation is open so it does not announce messages that
 * arrive right here.
 */
export function useConversation(serverId: string, peer: MessagePeerRef) {
  const { t } = useTranslation();
  const drizzleClient = useDrizzle();
  const { showNotification } = useNotificationStore();
  const [service] = useState(() => createMessageService(drizzleClient));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [limits, setLimits] = useState<MessageLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  // A string key for the effect/callback dependencies: `peer` is a new object on every render.
  const peerId = peer.kind === 'admin' ? 'admin' : peer.userId;
  const stablePeer = useMemo<MessagePeerRef>(
    () => (peerId === 'admin' ? { kind: 'admin' } : { kind: 'direct', userId: peerId }),
    [peerId],
  );

  useEffect(() => {
    setOpenConversation(conversationKey(serverId, stablePeer));
    return () => setOpenConversation(null);
  }, [serverId, stablePeer]);

  // Whatever is on screen is seen: opening the conversation, and a message arriving in it, clear its mark.
  const newestMessageId = messages[0]?.id;
  useEffect(() => {
    if (newestMessageId) {
      useUnseenMessagesStore
        .getState()
        .markSeen(conversationKey(serverId, stablePeer), newestMessageId);
    }
  }, [serverId, stablePeer, newestMessageId]);

  const reportFailure = useCallback(
    (error: unknown, fallbackKey: string) => {
      if (isOfflineError(error)) {
        showNotification(t('server_unreachable'), 'error');
      } else if (statusOf(error) === 429) {
        showNotification(t('message_limit_reached'), 'error');
      } else if (statusOf(error) === 403) {
        showNotification(t('message_not_friends'), 'error');
      } else {
        console.error('Messages:', error);
        showNotification(t(fallbackKey), 'error');
      }
    },
    [showNotification, t],
  );

  const refreshLimits = useCallback(async () => {
    try {
      setLimits(await service.getLimits(serverId));
    } catch {
      // The remaining count is a convenience: the server enforces the limit either way.
    }
  }, [service, serverId]);

  /** The newest page, merged into what is shown so older pages already loaded stay. */
  const load = useCallback(async () => {
    try {
      const page = await service.getMessages(serverId, stablePeer);
      setUnavailable(false);
      setMessages((current) => {
        if (page.nextBefore === null) return page.items;
        const oldestFresh = page.items.at(-1)?.id ?? '';
        return [...page.items, ...current.filter((message) => message.id < oldestFresh)];
      });
      setNextBefore((current) => (page.nextBefore === null ? null : (current ?? page.nextBefore)));
      await refreshLimits();
    } catch (error) {
      setUnavailable(true);
      if (!isOfflineError(error)) {
        console.error('Failed to load the conversation:', error);
        showNotification(t('messages_load_failed'), 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [service, serverId, stablePeer, refreshLimits, showNotification, t]);

  useEntityInitialLoad(load);
  const subscriptions = useMemo(
    () => [
      {
        event: MESSAGES_CHANGED,
        listener: (changedServerId?: string) => {
          if (!changedServerId || changedServerId === serverId) void load();
        },
      },
    ],
    [load, serverId],
  );
  useEntityEventSubscriptions(subscriptions);

  const loadOlder = useCallback(async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await service.getMessages(serverId, stablePeer, nextBefore);
      setMessages((current) => [...current, ...page.items]);
      setNextBefore(page.nextBefore);
    } catch (error) {
      reportFailure(error, 'messages_load_failed');
    } finally {
      setLoadingMore(false);
    }
  }, [nextBefore, loadingMore, service, serverId, stablePeer, reportFailure]);

  /** Returns whether it went through, so the composer knows to clear what was written. */
  const send = useCallback(
    async (body: string): Promise<boolean> => {
      setSending(true);
      try {
        const sent = await service.send(serverId, stablePeer, body);
        setMessages((current) => [sent, ...current.filter((m) => m.id !== sent.id)]);
        await refreshLimits();
        return true;
      } catch (error) {
        reportFailure(error, 'message_send_failed');
        return false;
      } finally {
        setSending(false);
      }
    },
    [service, serverId, stablePeer, refreshLimits, reportFailure],
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      AppAlert.alert(
        t('message_delete_title'),
        t('message_delete_confirm'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await service.deleteMessage(serverId, messageId);
                setMessages((current) => current.filter((m) => m.id !== messageId));
              } catch (error) {
                reportFailure(error, 'message_delete_failed');
              }
            },
          },
        ],
        { cancelable: true },
      );
    },
    [service, serverId, reportFailure, t],
  );

  const clear = useCallback(() => {
    AppAlert.alert(
      t('message_clear_title'),
      t('message_clear_confirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await service.clearConversation(serverId, stablePeer);
              setMessages([]);
              setNextBefore(null);
            } catch (error) {
              reportFailure(error, 'message_clear_failed');
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [service, serverId, stablePeer, reportFailure, t]);

  /** What the user may still send today to this peer; `null` when nothing limits them. */
  const remainingToday = useMemo(() => {
    if (!limits) return null;
    const scope = stablePeer.kind === 'admin' ? limits.admin : limits.direct;
    return scope.limit === null ? null : Math.max(0, scope.limit - scope.used);
  }, [limits, stablePeer]);

  return {
    messages,
    loading,
    loadingMore,
    sending,
    unavailable,
    hasMore: nextBefore !== null,
    remainingToday,
    loadOlder,
    send,
    deleteMessage,
    clear,
  };
}

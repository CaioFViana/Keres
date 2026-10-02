import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import {
  createMessageService,
  type Inbox,
  type MessageContact,
  MESSAGES_CHANGED,
} from '../services/MessageService';
import { useNotificationStore } from '../state/notificationStore';
import { useEntityEventSubscriptions, useEntityInitialLoad } from './useEntityRefreshLifecycle';

const EMPTY_INBOX: Inbox = { entries: [], unreachableServerIds: [] };

/**
 * The inbox: one line per conversation over every registered server, and everybody the user can
 * start one with. Read again when messages change on a server and when friendships do (a new friend
 * can be written to, an ex-friend leaves the list).
 */
export function useMessageInbox() {
  const { t } = useTranslation();
  const drizzleClient = useDrizzle();
  const { showNotification } = useNotificationStore();
  // Stable: `load` depends on it, and `load` runs unconditionally in the initial-load effect.
  const [service] = useState(() => createMessageService(drizzleClient));
  const [inbox, setInbox] = useState<Inbox>(EMPTY_INBOX);
  const [contacts, setContacts] = useState<MessageContact[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [nextInbox, nextContacts] = await Promise.all([
        service.getInbox(),
        service.getContacts(),
      ]);
      setInbox(nextInbox);
      setContacts(nextContacts);
    } catch (error) {
      console.error('Failed to load the messages:', error);
      showNotification(t('messages_load_failed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [service, showNotification, t]);

  useEntityInitialLoad(load);
  const subscriptions = useMemo(
    () => [
      { event: MESSAGES_CHANGED, listener: load },
      { event: 'friendship_changed', listener: load },
    ],
    [load],
  );
  useEntityEventSubscriptions(subscriptions);

  return { inbox, contacts, loading, reload: load };
}

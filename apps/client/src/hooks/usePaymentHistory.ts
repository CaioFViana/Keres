import { useCallback, useMemo, useRef, useState } from 'react';
import { useDrizzle } from '../db';
import type { ServerPaymentSelect, ServerSelect } from '../db/schema';
import { createPaymentHistoryService } from '../services/PaymentHistoryService';
import { PAYMENTS_CHANGED } from '../services/PaymentService';
import { useEntityEventSubscriptions, useEntityInitialLoad } from './useEntityRefreshLifecycle';

/**
 * A server's payment history for the screen: what is saved on this device shows at once (and offline), and
 * while the server answers it is asked again and the saved copy replaced. A payment made meanwhile - the server
 * says a payment changed - is brought in without leaving the screen.
 *
 * `stale` says what is on screen is the saved copy: the server could not be asked (or has not answered yet).
 */
export function usePaymentHistory(server: ServerSelect | undefined, online: boolean) {
  const db = useDrizzle();
  const service = useMemo(() => createPaymentHistoryService(db), [db]);
  const [items, setItems] = useState<ServerPaymentSelect[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const serverId = server?.id;

  const readSaved = useCallback(async () => {
    if (!serverId) return;
    const rows = await service.getForServer(serverId);
    setItems(rows);
    setLoaded(true);
  }, [service, serverId]);

  const refresh = useCallback(async () => {
    if (!server || !online) return;
    const mine = ++generation.current;
    setRefreshing(true);
    try {
      const result = await service.syncWithServer(server);
      if (mine !== generation.current) return;
      setFailed(false);
      if (result === 'synced') await readSaved();
    } catch {
      if (mine === generation.current) setFailed(true);
    } finally {
      if (mine === generation.current) setRefreshing(false);
    }
  }, [server, online, service, readSaved]);

  // What is saved first (it shows at once, and offline), then the server's answer on top of it.
  const look = useCallback(async () => {
    await readSaved();
    await refresh();
  }, [readSaved, refresh]);
  useEntityInitialLoad(look);

  const subscriptions = useMemo(
    () => [
      {
        event: PAYMENTS_CHANGED,
        listener: (changedServerId: string) => {
          if (changedServerId === serverId) void refresh();
        },
      },
    ],
    [serverId, refresh],
  );
  useEntityEventSubscriptions(subscriptions);

  return { items, loaded, refreshing, failed, stale: !online || failed, refresh };
}

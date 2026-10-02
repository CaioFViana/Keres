import { useCallback, useMemo, useRef, useState } from 'react';
import type { ServerSelect } from '../db/schema';
import {
  loadPaymentOverview,
  PAYMENTS_CHANGED,
  type PaymentOverview,
} from '../services/PaymentService';
import { useEntityEventSubscriptions, useEntityInitialLoad } from './useEntityRefreshLifecycle';

/**
 * What a server says about payments: whether it sells plans, and where the user stands. Read only while the
 * server answers (`online`), so a user working offline - or on a server with no payment plugin - sees nothing
 * and is never asked for anything. Read again when the server says a payment changed.
 *
 * `overview` is `null` when there is nothing to show: the server sells no plans, cannot be reached, or has
 * not answered yet.
 */
export function usePaymentOverview(server: ServerSelect | undefined, online: boolean) {
  const [overview, setOverview] = useState<PaymentOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const serverId = server?.id;

  const reload = useCallback(async () => {
    if (!server || !online) return;
    const mine = ++generation.current;
    setLoading(true);
    try {
      const next = await loadPaymentOverview(server);
      if (mine === generation.current) setOverview(next);
    } catch {
      // Unreachable or refusing: the plan is simply not shown now, and nothing is said about it.
      if (mine === generation.current) setOverview(null);
    } finally {
      if (mine === generation.current) setLoading(false);
    }
  }, [server, online]);

  const look = useCallback(async () => {
    if (!online) {
      // What an earlier look was still going to say is stale now: it must not show up after the server went away.
      generation.current += 1;
      return;
    }
    await reload();
  }, [online, reload]);
  useEntityInitialLoad(look);

  const subscriptions = useMemo(
    () => [
      {
        event: PAYMENTS_CHANGED,
        listener: (changedServerId: string) => {
          if (changedServerId === serverId) void reload();
        },
      },
    ],
    [serverId, reload],
  );
  useEntityEventSubscriptions(subscriptions);

  // Offline, what was known is not shown: a plan is only true while the server can be asked.
  return { overview: online ? overview : null, loading: online && loading, reload };
}

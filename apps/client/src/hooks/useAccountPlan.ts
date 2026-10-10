import type { AccountPlan } from '@keres/shared';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ServerSelect } from '../db/schema';
import { userApiService } from '../services/UserApiService';
import { PAYMENTS_CHANGED } from '../utils/paymentEvents';
import { useEntityEventSubscriptions, useEntityInitialLoad } from './useEntityRefreshLifecycle';

/**
 * The plan the person has on a server - what it comes with and how much of it they use - whether it is paid
 * for, given or the default every account starts on. Read only while the server answers (`online`), and read
 * again when a payment changes: it is the server's to say, so nothing is kept on the device.
 *
 * `plan` is `null` when there is nothing to show: the server cannot be reached, is older than the route, or
 * has not answered yet.
 */
export function useAccountPlan(server: ServerSelect | undefined, online: boolean) {
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  const generation = useRef(0);
  const serverId = server?.id;

  const reload = useCallback(async () => {
    if (!server || !online) return;
    const mine = ++generation.current;
    try {
      const next = await userApiService.getOwnPlan(server);
      if (mine === generation.current) setPlan(next);
    } catch {
      // Unreachable or refusing: the plan is simply not shown now.
      if (mine === generation.current) setPlan(null);
    }
  }, [server, online]);

  const look = useCallback(async () => {
    if (!online) {
      // What an earlier look was still going to say is stale now.
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
  return { plan: online ? plan : null, reload };
}

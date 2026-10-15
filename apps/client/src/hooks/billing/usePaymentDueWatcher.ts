import { useEffect } from 'react';
import type { AppDrizzleClient } from '@/src/db';
import { loadPaymentOverview, PAYMENTS_CHANGED } from '@/src/services/payments/PaymentService';
import { warnAboutPayment } from '@/src/services/payments/PaymentWarningService';
import { createServerService } from '@/src/services/servers/ServerService';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';

/**
 * Reminds the user, once, that a paid period is about to end or has run out - and only if they allowed it
 * (the setting is on) and only on a server that answers. It looks at start-up and when a server says a payment
 * changed; never on a timer. A user who works offline, or has no paid plan anywhere, is never bothered: there
 * is nothing to look at and nothing is shown.
 */
export function usePaymentDueWatcher(db: AppDrizzleClient | null, userId: string | null): void {
  useEffect(() => {
    if (!db || !userId) return;
    let cancelled = false;

    const look = async (onlyServerId?: string) => {
      const allowed = useUserSettingsStore.getState().warnPaymentDue;
      if (!allowed) return;
      const servers = await createServerService(db).getAllServers();
      for (const server of servers) {
        if (cancelled) return;
        if (onlyServerId && server.id !== onlyServerId) continue;
        try {
          const overview = await loadPaymentOverview(server);
          await warnAboutPayment(server, overview?.info.subscription ?? null, true);
        } catch {
          // Unreachable: nothing to say about it, and the next start-up looks again.
        }
      }
    };

    void look();
    const onChanged = (serverId: string) => void look(serverId);
    entityEventEmitter.on(PAYMENTS_CHANGED, onChanged);
    return () => {
      cancelled = true;
      entityEventEmitter.off(PAYMENTS_CHANGED, onChanged);
    };
  }, [db, userId]);
}

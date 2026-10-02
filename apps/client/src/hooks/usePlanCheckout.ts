import type { Checkout, CheckoutCreate } from '@keres/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';
import type { ServerSelect } from '../db/schema';
import { isOfflineError } from '../services/apiClient';
import { getCheckout, PAYMENTS_CHANGED, startCheckout } from '../services/PaymentService';
import { useEntityEventSubscriptions } from './useEntityRefreshLifecycle';

/** How often an open payment is asked about while the person is on the screen: the provider may be slow to tell. */
export const CHECKOUT_POLL_MS = 4000;

export type CheckoutPhase = 'idle' | 'starting' | 'pending' | 'paid' | 'failed' | 'expired';

const phaseOf = (checkout: Checkout): CheckoutPhase =>
  checkout.status === 'pending' ? 'pending' : checkout.status;

/**
 * One attempt to pay for a plan, from choosing to knowing how it ended. The person picks a plan, how often and a
 * method; the server says what to do next (open the provider's page, follow instructions) and this follows the
 * attempt until it is paid, failed or expired. It never holds a way to pay: that is entered at the provider.
 */
export function usePlanCheckout(server: ServerSelect | undefined) {
  const { t, i18n } = useTranslation();
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [phase, setPhase] = useState<CheckoutPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(0);
  const serverId = server?.id;

  const refresh = useCallback(async () => {
    if (!server || !checkout || phase !== 'pending') return;
    const mine = attempt.current;
    try {
      const next = await getCheckout(server, checkout.id);
      if (mine !== attempt.current) return;
      setCheckout(next);
      setPhase(phaseOf(next));
    } catch {
      // A missed look is not a failed payment: the next one tries again.
    }
  }, [server, checkout, phase]);

  useEffect(() => {
    if (phase !== 'pending') return;
    const timer = setInterval(() => void refresh(), CHECKOUT_POLL_MS);
    return () => clearInterval(timer);
  }, [phase, refresh]);

  // The server says a payment changed (the provider told it): look at once instead of waiting for the next tick.
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

  const start = useCallback(
    async (request: CheckoutCreate) => {
      if (!server) return;
      const mine = ++attempt.current;
      setError(null);
      setPhase('starting');
      try {
        const opened = await startCheckout(server, request, i18n.language);
        if (mine !== attempt.current) return;
        setCheckout(opened);
        setPhase(phaseOf(opened));
      } catch (failure) {
        if (mine !== attempt.current) return;
        setPhase('idle');
        setError(
          isOfflineError(failure) ? t('payment_error_offline') : t('payment_error_start_failed'),
        );
      }
    },
    [server, t, i18n.language],
  );

  /** Opens the provider's page for a payment that asks for it. */
  const openProviderPage = useCallback(async () => {
    const action = checkout?.action;
    if (action?.kind !== 'redirect') return;
    try {
      await Linking.openURL(action.url);
    } catch {
      setError(t('payment_error_open_failed'));
    }
  }, [checkout, t]);

  /** Leaves the attempt (finished or not) and goes back to choosing. */
  const reset = useCallback(() => {
    attempt.current += 1;
    setCheckout(null);
    setPhase('idle');
    setError(null);
  }, []);

  return { checkout, phase, error, start, openProviderPage, reset };
}

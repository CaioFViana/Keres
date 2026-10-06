import type { BillingInterval, Checkout, CheckoutCreate, PublicTier } from '@keres/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';
import type { ServerSelect } from '../db/schema';
import { isOfflineError } from '../services/apiClient';
import {
  getCheckout,
  PAYMENTS_CHANGED,
  startCheckout,
  verifyPlayPurchase,
} from '../services/PaymentService';
import { playDriver } from '../utils/playPurchase';
import { PlayPurchaseError, type PlayPurchaseTicket } from '../utils/playPurchaseTypes';
import { offerForPlayProduct } from '../utils/paymentPlans';
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
/** A plan as the reconcile pass needs it: the id and name plus the store products selling it. */
export type ReconcileTier = Pick<
  PublicTier,
  'id' | 'name' | 'playMonthlyProductId' | 'playYearlyProductId'
>;

/** What a native store purchase needs on top of the plan choice: the store product and package. */
export interface NativeCheckoutCreate {
  tierId: string;
  interval: BillingInterval;
  methodId: string;
  productId: string;
  packageName: string;
  /** The plan's name, for the success panel: there is no checkout row carrying it. */
  planName: string;
  /** Every plan on sale, so a purchase finished from an earlier attempt names its own plan. */
  tiers: ReconcileTier[];
}

/**
 * Confirms one unfinished store purchase with the server: maps its product back to the plan and
 * period it sells and relays the token. Anything unknown or refused stays unfinished (false) for
 * the next pass - only a confirmed purchase is ever finished with the store.
 */
async function confirmTicket(
  server: ServerSelect,
  request: NativeCheckoutCreate,
  ticket: PlayPurchaseTicket,
): Promise<boolean> {
  const offer = offerForPlayProduct(request.tiers, ticket.productId);
  if (!offer) return false;
  try {
    const answer = await verifyPlayPurchase(server, {
      ...offer,
      productId: ticket.productId,
      purchaseToken: ticket.purchaseToken,
      packageName: request.packageName,
    });
    return answer.active;
  } catch {
    return false;
  }
}

export function usePlanCheckout(server: ServerSelect | undefined) {
  const { t, i18n } = useTranslation();
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [phase, setPhase] = useState<CheckoutPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [paidPlanName, setPaidPlanName] = useState<string | null>(null);
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

  /**
   * Buys through the device's store: the store's sheet takes the payment, the token goes to the
   * server for checking, and the purchase is finished with the store only once the server confirmed
   * it. Backing out of the sheet is not an error - it just goes back to choosing.
   */
  const startNative = useCallback(
    async (request: NativeCheckoutCreate) => {
      if (!server) return;
      const mine = ++attempt.current;
      setError(null);
      setPaidPlanName(null);
      setPhase('starting');
      // A purchase the server already confirmed but the store never heard is finished would
      // otherwise block this buy (the store refuses an already-owned subscription): pick it up
      // first and treat it as paid instead of charging again.
      const confirmed = await playDriver
        .reconcileUnfinished((ticket) => confirmTicket(server, request, ticket))
        .catch(() => []);
      if (mine !== attempt.current) return;
      if (confirmed.some((ticket) => ticket.productId === request.productId)) {
        setPaidPlanName(request.planName);
        setPhase('paid');
        return;
      }
      // The store holds a live subscription for another plan: buying this one would start a second
      // charge beside it. Changing plans starts by ending the first, which only the store can do.
      if (confirmed.length > 0) {
        setPhase('idle');
        setError(t('payment_error_play_owned_other'));
        return;
      }
      try {
        const pending = await playDriver.buySubscription(request.productId);
        if (mine !== attempt.current) return;
        let active = false;
        try {
          const answer = await verifyPlayPurchase(server, {
            tierId: request.tierId,
            interval: request.interval,
            productId: request.productId,
            purchaseToken: pending.ticket.purchaseToken,
            packageName: request.packageName,
          });
          active = answer.active;
        } catch (failure) {
          if (mine !== attempt.current) return;
          setPhase('idle');
          setError(
            isOfflineError(failure) ? t('payment_error_offline') : t('payment_error_play_failed'),
          );
          return;
        }
        if (!active) {
          if (mine !== attempt.current) return;
          setPhase('idle');
          setError(t('payment_error_play_inactive'));
          return;
        }
        // The plan is granted; finishing tells the store not to refund. A finish that fails is
        // retried by reconciling, never by charging again.
        await pending.finish().catch(() => undefined);
        if (mine !== attempt.current) return;
        setPaidPlanName(request.planName);
        setPhase('paid');
      } catch (failure) {
        if (mine !== attempt.current) return;
        setPhase('idle');
        if (failure instanceof PlayPurchaseError && failure.kind === 'cancelled') return;
        if (failure instanceof PlayPurchaseError && failure.kind === 'unavailable') {
          setError(t('payment_error_play_unavailable'));
        } else if (failure instanceof PlayPurchaseError && failure.kind === 'misconfigured') {
          setError(t('payment_error_play_misconfigured'));
        } else {
          setError(t('payment_error_play_failed'));
        }
      }
    },
    [server, t],
  );

  /** Leaves the attempt (finished or not) and goes back to choosing. */
  const reset = useCallback(() => {
    attempt.current += 1;
    setCheckout(null);
    setPhase('idle');
    setError(null);
    setPaidPlanName(null);
  }, []);

  return { checkout, phase, error, start, startNative, paidPlanName, openProviderPage, reset };
}

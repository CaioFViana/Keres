import type {
  Checkout,
  CheckoutCreate,
  PaymentsInfo,
  PlayRelayRequest,
  PlayRelayResponse,
  PublicTiersResponse,
  Subscription,
  SwitchQuote,
} from '@keres/shared';
import type { ServerSelect } from '../db/schema';
import { paymentApi } from './PaymentApiService';

export { PAYMENTS_CHANGED } from '../utils/paymentEvents';

/** What the plan screen shows for a server that sells plans. */
export interface PaymentOverview {
  info: PaymentsInfo;
  plans: PublicTiersResponse | null;
}

/**
 * Reads what a server says about payments. A server with no payment plugin answers `enabled: false` (or has
 * no such route at all, if it is older): both mean the same - nothing about payments is shown - so neither
 * is an error. A server that cannot be reached throws, and the caller treats that as "show nothing now".
 */
export async function loadPaymentOverview(server: ServerSelect): Promise<PaymentOverview | null> {
  let info: PaymentsInfo;
  try {
    info = await paymentApi.getInfo(server);
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null;
    throw error;
  }
  if (!info.enabled) return null;
  const plans = await paymentApi.getPlans(server).catch(() => null);
  return { info, plans };
}

export const startCheckout = (
  server: ServerSelect,
  request: CheckoutCreate,
  language: string,
): Promise<Checkout> => paymentApi.startCheckout(server, request, language);

export const getCheckout = (server: ServerSelect, id: string): Promise<Checkout> =>
  paymentApi.getCheckout(server, id);

export const cancelSubscription = (server: ServerSelect): Promise<Subscription> =>
  paymentApi.cancelSubscription(server);

export const verifyPlayPurchase = (
  server: ServerSelect,
  request: PlayRelayRequest,
): Promise<PlayRelayResponse> => paymentApi.verifyPlayPurchase(server, request);

/** Said before paying: the time left on the current plan, and what it becomes on the one being chosen. */
export const getSwitchQuote = (
  server: ServerSelect,
  tierId: string,
  interval: string,
): Promise<SwitchQuote | null> => paymentApi.getSwitchQuote(server, tierId, interval);

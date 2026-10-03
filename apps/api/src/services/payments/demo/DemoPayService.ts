import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { env } from '../../../config/env';
import { db } from '../../../db';
import { paymentSubscriptions } from '../../../db/schema';
import { logger } from '../../../utils/logger';
import { subscriptionService } from '../SubscriptionService';
import { createDemoPayPlugin, DEMO_SIGNATURE_HEADER, signDemoNotice } from './DemoPayPlugin';
import {
  type DemoCharge,
  type DemoEvent,
  DemoProvider,
  DemoProviderError,
  type DemoSubscription,
} from './DemoProvider';

/**
 * The demo provider wired to this server: the one provider there is, the plugin that fronts it, and the way it
 * tells Keres what happened - a real, signed HTTP call to this server's own `/api/payments/webhook`, the same
 * road a real provider's notice takes (verified by the plugin, applied once, shown to the administrators).
 *
 * Everything here is for trying the flow; `PAYMENT_DEMO` is what turns it on.
 */
export const demoProvider = new DemoProvider();

/** The key the provider signs with: given, or derived from the JWT secret so it is not a well-known string. */
export function demoSecret(): string {
  return (
    env.PAYMENT_DEMO_SECRET ??
    createHmac('sha256', env.JWT_SECRET).update('keres-demo-pay').digest('hex')
  );
}

export function demoBaseUrl(): string {
  return env.PAYMENT_DEMO_BASE_URL ?? `http://localhost:${env.PORT}`;
}

export function createConfiguredDemoPlugin() {
  return createDemoPayPlugin({
    provider: demoProvider,
    secret: demoSecret(),
    baseUrl: demoBaseUrl(),
  });
}

export interface DemoDelivery {
  /** Whether Keres accepted the notice. */
  ok: boolean;
  status: number;
  /** How many of its notices changed something on Keres' side. */
  applied: number;
}

/** How a notice reaches Keres. Replaceable, because a test has no port to call. */
export type DemoWebhookTransport = (rawBody: string, signature: string) => Promise<Response>;

const loopbackTransport: DemoWebhookTransport = (rawBody, signature) =>
  fetch(`http://127.0.0.1:${env.PORT}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [DEMO_SIGNATURE_HEADER]: signature },
    body: rawBody,
  });

let transport: DemoWebhookTransport = loopbackTransport;

export function setDemoWebhookTransport(next: DemoWebhookTransport | null): void {
  transport = next ?? loopbackTransport;
}

export async function deliverDemoEvents(events: DemoEvent[]): Promise<DemoDelivery> {
  const result: DemoDelivery = { ok: true, status: 200, applied: 0 };
  for (const event of events) {
    const rawBody = JSON.stringify(event);
    try {
      const response = await transport(rawBody, signDemoNotice(rawBody, demoSecret()));
      result.status = response.status;
      if (!response.ok) {
        result.ok = false;
        continue;
      }
      const answer = (await response.json().catch(() => null)) as { applied?: number } | null;
      result.applied += answer?.applied ?? 0;
    } catch (error) {
      logger.warn('The demo provider could not reach this server with a notice', {
        error: error instanceof Error ? error.message : String(error),
      });
      result.ok = false;
      result.status = 0;
    }
  }
  return result;
}

export interface DemoChargeView {
  id: string;
  status: DemoCharge['status'];
  kind: DemoCharge['kind'];
  methodId: DemoCharge['methodId'];
  code: string | null;
  tierName: string;
  interval: DemoCharge['interval'];
  amountCents: number;
  currency: string;
  payerName: string;
  paidAt: string | null;
  failureReason: string | null;
}

const toChargeView = (charge: DemoCharge): DemoChargeView => ({
  id: charge.id,
  status: charge.status,
  kind: charge.kind,
  methodId: charge.methodId,
  code: charge.code,
  tierName: charge.tierName,
  interval: charge.interval,
  amountCents: charge.amountCents,
  currency: charge.currency,
  payerName: charge.username,
  paidAt: charge.paidAt,
  failureReason: charge.failureReason,
});

export class DemoPayService {
  /** What the payment page shows for a charge; the id is all that is needed to open it, as on a real hosted page. */
  getCharge(idOrReference: string): DemoChargeView {
    const charge = demoProvider.findCharge(idOrReference);
    if (!charge) throw new DemoProviderError('That payment does not exist.', 404);
    return toChargeView(charge);
  }

  private async settle(idOrReference: string, events: DemoEvent[]) {
    const delivery = await deliverDemoEvents(events);
    return { charge: this.getCharge(idOrReference), delivery };
  }

  /** "Debug: confirm that this was paid". */
  pay(idOrReference: string) {
    return this.settle(idOrReference, demoProvider.pay(idOrReference));
  }

  /** "Debug: the payment failed". */
  fail(idOrReference: string) {
    return this.settle(idOrReference, demoProvider.fail(idOrReference));
  }

  /** "Debug: let it expire". */
  expire(idOrReference: string) {
    return this.settle(idOrReference, demoProvider.expire(idOrReference));
  }

  /** What the person has at the provider: their subscriptions and the payments waiting for them. */
  overview(userId: string): { subscriptions: DemoSubscription[]; open: DemoChargeView[] } {
    return {
      subscriptions: demoProvider.subscriptionsOf(userId),
      open: demoProvider.openChargesOf(userId).map(toChargeView),
    };
  }

  private ownSubscription(userId: string, subscriptionId: string): DemoSubscription {
    const subscription = demoProvider.subscriptionsOf(userId).find((s) => s.id === subscriptionId);
    if (!subscription) throw new DemoProviderError('That subscription does not exist.', 404);
    return subscription;
  }

  /** "The provider charges the subscription again": a saved card at once, a PIX or boleto as an offer to pay. */
  async renew(userId: string, subscriptionId: string, outcome: 'paid' | 'failed') {
    this.ownSubscription(userId, subscriptionId);
    const { charge, events } = demoProvider.renew(subscriptionId, outcome);
    const delivery = await deliverDemoEvents(events);
    return { charge: toChargeView(charge), delivery };
  }

  /** The provider ends the subscription on its own and tells Keres, which lets the paid period run out. */
  async cancel(userId: string, subscriptionId: string) {
    this.ownSubscription(userId, subscriptionId);
    return { delivery: await deliverDemoEvents(demoProvider.cancel(subscriptionId)) };
  }

  /**
   * Makes the person's paid period run out now, so the late-payment side can be seen without waiting a month:
   * the date moves into the past and the job that marks subscriptions due runs at once. Not something a
   * provider does - a debugging lever of the demo.
   */
  async lapse(userId: string): Promise<{ due: number; ended: number }> {
    await db
      .update(paymentSubscriptions)
      .set({ paidUntil: new Date(Date.now() - 1000) })
      .where(eq(paymentSubscriptions.userId, userId));
    return subscriptionService.markDue();
  }
}

export const demoPayService = new DemoPayService();
export { DemoProviderError };

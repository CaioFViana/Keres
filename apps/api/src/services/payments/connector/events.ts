import type { PaymentEventWire } from '@keres/shared';
import type { PaymentEvent } from '@keres/shared/payments/PaymentConnector';

/** An event as it travels (JSON, a date as text) in the terms the subscriptions are written in. */
export function toPaymentEvent(wire: PaymentEventWire): PaymentEvent {
  switch (wire.type) {
    case 'payment.succeeded':
      return {
        type: 'payment.succeeded',
        eventId: wire.eventId,
        ...(wire.checkoutId ? { checkoutId: wire.checkoutId } : {}),
        ...(wire.subscriptionReference
          ? { subscriptionReference: wire.subscriptionReference }
          : {}),
        paidAt: new Date(wire.paidAt),
        amountCents: wire.amountCents,
        currency: wire.currency.toUpperCase(),
      };
    case 'payment.failed':
      return {
        type: 'payment.failed',
        eventId: wire.eventId,
        ...(wire.checkoutId ? { checkoutId: wire.checkoutId } : {}),
        ...(wire.subscriptionReference
          ? { subscriptionReference: wire.subscriptionReference }
          : {}),
        ...(wire.reason ? { reason: wire.reason } : {}),
      };
    case 'subscription.canceled':
      return {
        type: 'subscription.canceled',
        eventId: wire.eventId,
        subscriptionReference: wire.subscriptionReference,
      };
    case 'payment.refunded':
      return {
        type: 'payment.refunded',
        eventId: wire.eventId,
        subscriptionReference: wire.subscriptionReference,
        refundedAt: new Date(wire.refundedAt),
        chargedAt: new Date(wire.chargedAt),
        amountCents: wire.amountCents,
        currency: wire.currency.toUpperCase(),
        endsAccess: wire.endsAccess,
      };
    case 'checkout.expired':
      return { type: 'checkout.expired', eventId: wire.eventId, checkoutId: wire.checkoutId };
  }
}

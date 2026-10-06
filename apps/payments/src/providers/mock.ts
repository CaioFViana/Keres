import { STORE_CSS } from '../storefront';
import type { CheckoutRequestWire, PaymentEventWire, PaymentMethodOption } from '../wire';
import type { Provider, ProviderContext } from './types';

/**
 * A fake provider for physical end-to-end tests: no PSP, no real money. The checkout redirects
 * to a page on this same service (`/v1/mock/pay`) with Confirm / Fail buttons; confirming
 * reports `payment.succeeded` to Keres exactly like a real provider would.
 *
 * Development only, twice over: it registers solely when `MOCK_METHODS=true` **and** the
 * public base URL is loopback. Pointing this at anything else silently disables it - a mock
 * that grants plans must never face the internet.
 */

export const MOCK_METHOD_ID = 'mock';

const outcomes = new Map<string, 'confirmed' | 'rejected'>();

export function mockEnabled(publicBaseUrl: string): boolean {
  if (process.env.MOCK_METHODS !== 'true') return false;
  try {
    const host = new URL(publicBaseUrl).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch {
    return false;
  }
}

export function mockOutcome(checkoutId: string): 'confirmed' | 'rejected' | undefined {
  return outcomes.get(checkoutId);
}

/** Renewals the fake bank charged without telling Keres, per subscription reference (development only). */
const renewals = new Map<string, string[]>();

/**
 * The fake bank charges a subscription again and says nothing: the notice that never comes, so the
 * safety net can be tried end to end. Returns the id the charge is known by.
 */
export function mockRenew(subscriptionReference: string): string {
  const list = renewals.get(subscriptionReference) ?? [];
  const eventId = `${subscriptionReference}-renewal-${list.length + 1}`;
  renewals.set(subscriptionReference, [...list, eventId]);
  return eventId;
}

export function mockDecide(checkoutId: string, verdict: 'confirmed' | 'rejected'): void {
  outcomes.set(checkoutId, verdict);
}

export function mockPage(checkout: {
  checkoutId: string;
  tierName: string;
  amountCents: number;
  currency: string;
}): string {
  const amount = (checkout.amountCents / 100).toFixed(2);
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Mock payment</title><style>' +
    STORE_CSS +
    '</style></head><body>' +
    '<div class="banner">TEST MODE - no real money moves here.</div>' +
    '<main><h1>Mock payment</h1>' +
    '<div class="card"><h2>' +
    escapeHtml(checkout.tierName) +
    '</h2><p><span class="price">' +
    escapeHtml(amount) +
    ' ' +
    escapeHtml(checkout.currency) +
    '</span></p>' +
    '<p class="muted">The buttons below stand in for the bank.</p>' +
    '<form method="post" action="/v1/mock/pay">' +
    '<input type="hidden" name="checkoutId" value="' +
    escapeHtml(checkout.checkoutId) +
    '">' +
    '<div class="row">' +
    '<button class="primary" type="submit" name="verdict" value="confirmed">Confirm payment</button>' +
    '<button type="submit" name="verdict" value="rejected">Fail payment</button>' +
    '</div></form></div></main></body></html>'
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function createMockProvider(): Provider {
  return {
    methodIds: [MOCK_METHOD_ID],
    hasStatus: true,
    hasCancel: true,
    hasReconcile: true,

    methods(currency: string): PaymentMethodOption[] {
      if (!/^[A-Z]{3}$/.test(currency)) return [];
      return [
        { id: MOCK_METHOD_ID, label: 'Mock card (test only)', recurring: true, flow: 'redirect' },
      ];
    },

    async createCheckout(request: CheckoutRequestWire, context: ProviderContext) {
      const reference = `mock-${request.checkoutId}`;
      context.store.remember(request.checkoutId, {
        methodId: MOCK_METHOD_ID,
        providerReference: reference,
        subscriptionReference: reference,
        amountCents: request.amountCents,
        currency: request.currency,
        tierName: request.tier.name,
      });
      return {
        providerReference: reference,
        action: {
          kind: 'redirect',
          url: `${context.config.publicBaseUrl}/v1/mock/pay?checkoutId=${encodeURIComponent(request.checkoutId)}`,
        },
      };
    },

    async getStatus(checkoutId, providerReference, context) {
      const record = context.store.recall(checkoutId);
      if (!record || record.providerReference !== providerReference) return null;
      const outcome = outcomes.get(checkoutId);
      if (outcome === 'confirmed') {
        return {
          type: 'payment.succeeded',
          eventId: `mock-${checkoutId}-paid`,
          checkoutId,
          subscriptionReference: record.subscriptionReference,
          paidAt: new Date().toISOString(),
          amountCents: record.amountCents ?? 0,
          currency: record.currency ?? 'USD',
        };
      }
      if (outcome === 'rejected') {
        return {
          type: 'payment.failed',
          eventId: `mock-${checkoutId}-failed`,
          checkoutId,
          reason: 'rejected in the mock page',
        };
      }
      return null;
    },

    ownsSubscription: (subscriptionReference) => subscriptionReference.startsWith('mock-'),
    ownsCheckoutReference: (providerReference) => providerReference.startsWith('mock-'),

    async listSubscriptionEvents(subscriptionReference, _since, context) {
      const events: PaymentEventWire[] = [];
      for (const [checkoutId, record] of context.store.entries()) {
        if (record.subscriptionReference !== subscriptionReference) continue;
        if (outcomes.get(checkoutId) !== 'confirmed') continue;
        events.push({
          type: 'payment.succeeded',
          eventId: `mock-${checkoutId}-paid`,
          checkoutId,
          subscriptionReference,
          paidAt: new Date().toISOString(),
          amountCents: record.amountCents ?? 0,
          currency: record.currency ?? 'USD',
        });
      }
      const [known] = [...context.store.entries()].filter(
        ([, record]) => record.subscriptionReference === subscriptionReference,
      );
      for (const eventId of renewals.get(subscriptionReference) ?? []) {
        events.push({
          type: 'payment.succeeded',
          eventId,
          subscriptionReference,
          paidAt: new Date().toISOString(),
          amountCents: known?.[1].amountCents ?? 0,
          currency: known?.[1].currency ?? 'USD',
        });
      }
      return events;
    },

    async cancelSubscription(_subscriptionReference, _context) {
      // Nothing to stop: there was never a real charge.
    },
  };
}

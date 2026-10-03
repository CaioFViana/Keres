import type { BillingInterval } from '@keres/shared/payments/PaymentConnector';
import { ulid } from 'ulid';

/**
 * A payment provider that does not exist: what a real one (Stripe, Mercado Pago...) would be on the other
 * side of the plugin, kept in memory so the whole flow can be seen working. It owns what a provider owns - the
 * charges, the subscriptions, the saved payment method - and speaks in its own terms (`charge.paid`), which
 * `DemoPayPlugin` translates for Keres exactly as a real plugin translates its provider's.
 *
 * It holds nothing real: the "card" is a button, the PIX code and the boleto line are made-up text. Being in
 * memory, it forgets everything when the server restarts (Keres keeps its own side, so a subscription that
 * was already paid stays paid).
 */
export type DemoMethodId = 'card' | 'pix' | 'boleto';
export const DEMO_METHOD_IDS: readonly DemoMethodId[] = ['card', 'pix', 'boleto'];

export type DemoChargeStatus = 'open' | 'paid' | 'failed' | 'expired';

export interface DemoCharge {
  id: string;
  /** Keres' attempt this charge was opened for; absent for a renewal, which no attempt of Keres' started. */
  reference: string | null;
  userId: string;
  username: string;
  tierId: string;
  tierName: string;
  interval: BillingInterval;
  amountCents: number;
  currency: string;
  methodId: DemoMethodId;
  kind: 'first' | 'renewal';
  status: DemoChargeStatus;
  subscriptionId: string | null;
  /** What the person would pay with: a PIX code, a boleto line. Nothing for a card. */
  code: string | null;
  createdAt: string;
  paidAt: string | null;
  failureReason: string | null;
}

export interface DemoSubscription {
  id: string;
  userId: string;
  username: string;
  tierId: string;
  tierName: string;
  interval: BillingInterval;
  amountCents: number;
  currency: string;
  methodId: DemoMethodId;
  /** A saved card the provider charges by itself on renewal; a PIX or boleto has to be paid again each time. */
  autoCharge: boolean;
  status: 'active' | 'canceled';
  createdAt: string;
}

/** What the provider sends: its own vocabulary, with ids that are the same each time for the same fact. */
export type DemoEvent =
  | {
      id: string;
      type: 'charge.paid';
      data: {
        chargeId: string;
        reference: string | null;
        subscriptionId: string;
        amountCents: number;
        currency: string;
        paidAt: string;
      };
    }
  | {
      id: string;
      type: 'charge.failed';
      data: {
        chargeId: string;
        reference: string | null;
        subscriptionId: string | null;
        reason: string;
      };
    }
  | { id: string; type: 'charge.expired'; data: { chargeId: string; reference: string } }
  | { id: string; type: 'subscription.canceled'; data: { subscriptionId: string } };

export interface NewDemoCharge {
  reference: string | null;
  userId: string;
  username: string;
  tierId: string;
  tierName: string;
  interval: BillingInterval;
  amountCents: number;
  currency: string;
  methodId: string;
  subscriptionId?: string | null;
}

export class DemoProviderError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = 'DemoProviderError';
  }
}

const isMethod = (value: string): value is DemoMethodId =>
  (DEMO_METHOD_IDS as readonly string[]).includes(value);

const digits = (length: number) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');

export class DemoProvider {
  private readonly charges = new Map<string, DemoCharge>();
  private readonly subscriptions = new Map<string, DemoSubscription>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  reset(): void {
    this.charges.clear();
    this.subscriptions.clear();
  }

  createCharge(input: NewDemoCharge): DemoCharge {
    if (!isMethod(input.methodId)) throw new DemoProviderError('Unknown payment method.', 400);
    const methodId = input.methodId;
    const id = `ch_${ulid().toLowerCase()}`;
    const charge: DemoCharge = {
      id,
      reference: input.reference,
      userId: input.userId,
      username: input.username,
      tierId: input.tierId,
      tierName: input.tierName,
      interval: input.interval,
      amountCents: input.amountCents,
      currency: input.currency,
      methodId,
      kind: input.subscriptionId ? 'renewal' : 'first',
      status: 'open',
      subscriptionId: input.subscriptionId ?? null,
      code:
        methodId === 'pix'
          ? `DEMO-PIX-${id.slice(-12).toUpperCase()}`
          : methodId === 'boleto'
            ? `DEMO ${digits(5)}.${digits(5)} ${digits(5)}.${digits(6)} ${digits(5)}.${digits(6)} ${digits(1)} ${digits(14)}`
            : null,
      createdAt: this.now().toISOString(),
      paidAt: null,
      failureReason: null,
    };
    this.charges.set(id, charge);
    return charge;
  }

  /** A charge by its own id, or by the id of the Keres attempt it was opened for. */
  findCharge(idOrReference: string): DemoCharge | undefined {
    const direct = this.charges.get(idOrReference);
    if (direct) return direct;
    for (const charge of this.charges.values()) {
      if (charge.reference === idOrReference) return charge;
    }
    return undefined;
  }

  private require(idOrReference: string): DemoCharge {
    const charge = this.findCharge(idOrReference);
    if (!charge) throw new DemoProviderError('That payment does not exist.', 404);
    return charge;
  }

  private requireOpen(idOrReference: string): DemoCharge {
    const charge = this.require(idOrReference);
    if (charge.status !== 'open') {
      throw new DemoProviderError(`That payment is already ${charge.status}.`, 409);
    }
    return charge;
  }

  /** The person paid. The first payment of a plan opens the subscription; a card is kept for the renewals. */
  pay(idOrReference: string): DemoEvent[] {
    const charge = this.requireOpen(idOrReference);
    charge.status = 'paid';
    charge.paidAt = this.now().toISOString();
    if (!charge.subscriptionId) {
      const subscription: DemoSubscription = {
        id: `sub_${ulid().toLowerCase()}`,
        userId: charge.userId,
        username: charge.username,
        tierId: charge.tierId,
        tierName: charge.tierName,
        interval: charge.interval,
        amountCents: charge.amountCents,
        currency: charge.currency,
        methodId: charge.methodId,
        autoCharge: charge.methodId === 'card',
        status: 'active',
        createdAt: charge.paidAt,
      };
      this.subscriptions.set(subscription.id, subscription);
      charge.subscriptionId = subscription.id;
    }
    return [
      {
        id: `${charge.id}:paid`,
        type: 'charge.paid',
        data: {
          chargeId: charge.id,
          reference: charge.reference,
          subscriptionId: charge.subscriptionId,
          amountCents: charge.amountCents,
          currency: charge.currency,
          paidAt: charge.paidAt,
        },
      },
    ];
  }

  fail(idOrReference: string, reason = 'Payment declined (demo)'): DemoEvent[] {
    const charge = this.requireOpen(idOrReference);
    charge.status = 'failed';
    charge.failureReason = reason;
    return [
      {
        id: `${charge.id}:failed`,
        type: 'charge.failed',
        data: {
          chargeId: charge.id,
          reference: charge.reference,
          subscriptionId: charge.subscriptionId,
          reason,
        },
      },
    ];
  }

  /** The time to pay ran out. A renewal's offer lapses quietly: no attempt of Keres' is waiting on it. */
  expire(idOrReference: string): DemoEvent[] {
    const charge = this.requireOpen(idOrReference);
    charge.status = 'expired';
    if (!charge.reference) return [];
    return [
      {
        id: `${charge.id}:expired`,
        type: 'charge.expired',
        data: { chargeId: charge.id, reference: charge.reference },
      },
    ];
  }

  private subscription(id: string): DemoSubscription {
    const subscription = this.subscriptions.get(id);
    if (!subscription) throw new DemoProviderError('That subscription does not exist.', 404);
    return subscription;
  }

  private openRenewal(subscription: DemoSubscription): DemoCharge | undefined {
    return [...this.charges.values()].find(
      (charge) =>
        charge.subscriptionId === subscription.id &&
        charge.kind === 'renewal' &&
        charge.status === 'open',
    );
  }

  /**
   * The provider's own schedule: it is time to charge the subscription again. A saved card is charged at once
   * (it works, or it is declined); a PIX or boleto can only be offered, and waits for the person to pay it.
   */
  renew(
    subscriptionId: string,
    outcome: 'paid' | 'failed' = 'paid',
  ): { charge: DemoCharge; events: DemoEvent[] } {
    const subscription = this.subscription(subscriptionId);
    if (subscription.status !== 'active') {
      throw new DemoProviderError('That subscription is canceled.', 409);
    }
    const charge = this.offerRenewal(subscription);
    if (!subscription.autoCharge) return { charge, events: [] };
    const events =
      outcome === 'paid' ? this.pay(charge.id) : this.fail(charge.id, 'Card declined (demo)');
    return { charge, events };
  }

  /** A renewal waiting to be paid, opened once however often it is asked for. */
  offerRenewal(subscription: DemoSubscription): DemoCharge {
    return (
      this.openRenewal(subscription) ??
      this.createCharge({
        reference: null,
        userId: subscription.userId,
        username: subscription.username,
        tierId: subscription.tierId,
        tierName: subscription.tierName,
        interval: subscription.interval,
        amountCents: subscription.amountCents,
        currency: subscription.currency,
        methodId: subscription.methodId,
        subscriptionId: subscription.id,
      })
    );
  }

  /** Keres says the paid period ran out unpaid: the provider puts a renewal in front of the person. */
  chase(subscriptionId: string): DemoCharge | null {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || subscription.status !== 'active') return null;
    return this.offerRenewal(subscription);
  }

  cancel(subscriptionId: string): DemoEvent[] {
    const subscription = this.subscription(subscriptionId);
    if (subscription.status === 'canceled') return [];
    subscription.status = 'canceled';
    for (const charge of this.charges.values()) {
      if (charge.subscriptionId === subscriptionId && charge.status === 'open') {
        charge.status = 'expired';
      }
    }
    return [
      {
        id: `${subscription.id}:canceled`,
        type: 'subscription.canceled',
        data: { subscriptionId },
      },
    ];
  }

  subscriptionsOf(userId: string): DemoSubscription[] {
    return [...this.subscriptions.values()].filter((entry) => entry.userId === userId);
  }

  /** The person's charges still waiting to be paid, newest first. */
  openChargesOf(userId: string): DemoCharge[] {
    return [...this.charges.values()]
      .filter((charge) => charge.userId === userId && charge.status === 'open')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

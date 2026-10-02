import type { PaymentAction, PaymentMethodOption } from '../payments/PaymentPlugin';
import type { BillingInterval } from '../payments/PaymentPlugin';
import type { CheckoutStatus, PaymentLedgerKind, SubscriptionStatus } from '../metadata/Payments';

/**
 * The wire shapes of the payments feature. Dates are ISO strings, like the other wire types. None of them
 * can carry a way to pay: there is no such field anywhere in the feature.
 */

/** A person's subscription on a server, as they see it. */
export interface Subscription {
  tierId: string;
  tierName: string;
  interval: BillingInterval;
  status: SubscriptionStatus;
  /** The end of the period that is paid; the plan is granted until then. */
  paidUntil: string;
  lastPaymentAt: string | null;
  amountCents: number;
  currency: string;
  /** It will not renew: it ends at `paidUntil`. */
  cancelAtPeriodEnd: boolean;
  /** Whether the provider can be told to stop charging from here (otherwise the person does it at the provider). */
  canCancelHere: boolean;
}

/** What a server says about payments: whether it sells plans at all, how, and where the person stands. */
export interface PaymentsInfo {
  /** `false` when the server has no payment plugin - nothing about payments is shown anywhere then. */
  enabled: boolean;
  provider: { id: string; displayName: string } | null;
  currency: string;
  methods: PaymentMethodOption[];
  subscription: Subscription | null;
}

/** An attempt to pay for a plan. */
export interface Checkout {
  id: string;
  status: CheckoutStatus;
  tierId: string;
  tierName: string;
  interval: BillingInterval;
  amountCents: number;
  currency: string;
  methodId: string;
  /** What the person has to do; `null` once the attempt is over. */
  action: PaymentAction | null;
  expiresAt: string | null;
  createdAt: string;
  /** Why it failed, when the provider said (short, free of anything personal). */
  failureReason: string | null;
}

/** The user behind a subscription or a payment, as the administrators see them. */
export interface AdminPaymentUser {
  id: string;
  username: string;
  tag: string;
  isDeleted: boolean;
}

/** One subscription in the admin list: the situation and the key values - never a way to pay. */
export interface AdminSubscription {
  user: AdminPaymentUser | null;
  tierId: string;
  tierName: string;
  interval: BillingInterval;
  status: SubscriptionStatus;
  paidUntil: string;
  lastPaymentAt: string | null;
  amountCents: number;
  currency: string;
  cancelAtPeriodEnd: boolean;
  providerId: string;
  /** The provider's own id for the subscription, to look it up there. */
  providerReference: string | null;
  createdAt: string;
}

export interface AdminSubscriptionPage {
  items: AdminSubscription[];
  total: number;
  page: number;
  pageSize: number;
}

/** One line of the ledger: what the provider reported, and what Keres did with it. */
export interface AdminPaymentEvent {
  id: string;
  kind: PaymentLedgerKind;
  user: AdminPaymentUser | null;
  tierName: string | null;
  amountCents: number | null;
  currency: string | null;
  providerId: string;
  providerReference: string | null;
  /** Short and free of anything personal. */
  detail: string | null;
  createdAt: string;
}

export interface AdminPaymentEventPage {
  items: AdminPaymentEvent[];
  total: number;
  page: number;
  pageSize: number;
}

/** The numbers an administrator looks at first. */
export interface AdminPaymentSummary {
  enabled: boolean;
  provider: { id: string; displayName: string } | null;
  currency: string;
  subscriptions: { active: number; due: number; canceled: number };
  /** Active ones whose period ends within the next `PAYMENT_WARNING_DAYS` days. */
  endingSoon: number;
  /** Payments received in the last 30 days: how many, and the sum in the minor unit of `currency`. */
  last30Days: { payments: number; failures: number; amountCents: number };
  /** The monthly value of the active subscriptions (yearly ones divided by twelve), in minor units. */
  monthlyRecurringCents: number;
}

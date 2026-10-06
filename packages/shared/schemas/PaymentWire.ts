import type { PaymentAction, PaymentMethodOption } from '../payments/PaymentConnector';
import type { BillingInterval } from '../payments/PaymentConnector';
import type {
  CheckoutStatus,
  PaymentHistoryKind,
  PaymentLedgerKind,
  SubscriptionStatus,
} from '../metadata/Payments';

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
  /**
   * Whether the provider charges this subscription again by itself (a saved card). `false` when each period has to
   * be paid again by the person (PIX, boleto). A server that predates the field does not send it: read that as true.
   */
  autoRenews: boolean;
  /** The plan is a gift from the administrators: it ends on its date and nothing charges it. */
  complimentary: boolean;
}

/**
 * One line of a person's own payment history. `id` is this server's own id for the payment - never the
 * provider's reference or a store token, which stay on the server.
 */
export interface PaymentHistoryItem {
  id: string;
  kind: PaymentHistoryKind;
  tierName: string | null;
  /** Minor units of `currency`; null when the line has no amount (a failure). */
  amountCents: number | null;
  currency: string | null;
  /** When this server recorded it. */
  createdAt: string;
}

/** A page of the history, newest first. `nextBefore` is what to ask for next; null when there is no more. */
export interface PaymentHistoryPage {
  items: PaymentHistoryItem[];
  nextBefore: string | null;
}

/**
 * What changing plan does to the time a person has left, said before they pay. The time left on the old plan
 * is worth what it cost and buys days of the new one at its price: it is not carried over day for day.
 */
export interface SwitchQuote {
  fromTierName: string;
  toTierName: string;
  /** Days left on the plan they are on. */
  remainingDays: number;
  /** What those days become on the new plan, before the period they are paying for is added. */
  convertedDays: number;
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

/** `POST /api/payments/play/verify` answer: whether the token checked out, and the plan after it. */
export interface PlayRelayResponse {
  active: boolean;
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

/** A person's subscription as an administrator needs it to give them a plan, and what giving would involve. */
export interface AdminUserSubscription {
  subscription: AdminSubscription | null;
  /** Whether the payment plugin can stop the provider charging (otherwise the administrator confirms it was stopped). */
  canCancelAtProvider: boolean;
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

/**
 * Whether the money side is working, for the administrators: is the connector there, are the provider's notices
 * arriving, is the safety net finding things, is anything stuck. Warnings are codes the panel says in words.
 */
export type AdminPaymentWarning =
  | 'no-connector'
  | 'no-notice'
  | 'reconcile-failing'
  | 'reconcile-found'
  | 'overdue'
  | 'unmatched'
  | 'stale-attempts';

export interface AdminPaymentHealth {
  connector: { connected: boolean; id: string | null; capabilities: string[] };
  /** The newest notice a provider sent (a line of the ledger carrying a provider's own id); null if none yet. */
  lastNoticeAt: string | null;
  /** What the safety net did on its last run since this server started; null before its first run. */
  reconciliation: {
    lastRunAt: string;
    subscriptionsAsked: number;
    attemptsAsked: number;
    found: number;
    failures: number;
  } | null;
  /** Notices the safety net had to find in the last 7 days (each one is a notice that never arrived). */
  foundByReconciliation7d: number;
  /** Subscriptions past their date: still inside the margin (`renewing`), or already `due`. */
  overdue: { renewing: number; due: number };
  /** Attempts open for more than an hour. */
  staleAttempts: number;
  /** Notices about something this server never opened, in the last 7 days. */
  unmatched7d: number;
  warnings: AdminPaymentWarning[];
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
  last30Days: { payments: number; failures: number; amountCents: number; refundedCents: number };
  /** The monthly value of the active subscriptions (yearly ones divided by twelve), in minor units. */
  monthlyRecurringCents: number;
  /**
   * Payments (or plans given by hand) are in use but the server has no default plan: when somebody's paid period
   * ends and no plan was assigned to them, nothing limits them any more - the opposite of what a plan is for.
   */
  noDefaultTier: boolean;
}

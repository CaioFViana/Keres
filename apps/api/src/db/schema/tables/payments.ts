import {
  BILLING_INTERVALS,
  CHECKOUT_STATUSES,
  PAYMENT_LEDGER_KINDS,
  SUBSCRIPTION_STATUSES,
} from '@keres/shared/metadata/Payments';
import {
  boolean,
  index,
  integer,
  json,
  table,
  text,
  timestamp,
  timestampNow,
  uniqueIndex,
} from '../columns';

/**
 * What a payment plugin's provider has told this server about who has paid for what.
 *
 * None of these tables can hold a way to pay: no card number, expiry, security code or bank account has a
 * column anywhere, and the plugin contract has no field to carry one. They keep the plan, the period, the
 * status, the amount and the provider's own references - enough to know what each person may use and for
 * the administrators to find the payment at the provider.
 *
 * No foreign keys, like `audit_events`: the ledger must outlive the users and plans it speaks of.
 */

/** A person's subscription on this server: one row each, kept up to date by the provider's notices. */
export const paymentSubscriptions = table(
  'payment_subscriptions',
  {
    userId: text('user_id').primaryKey(),
    tierId: text('tier_id').notNull(),
    interval: text('interval', { enum: BILLING_INTERVALS }).notNull(),
    status: text('status', { enum: SUBSCRIPTION_STATUSES }).notNull(),
    /** The end of the period that is paid: the plan is granted until then. */
    paidUntil: timestamp('paid_until').notNull(),
    lastPaymentAt: timestamp('last_payment_at'),
    /** What the last payment was, minor units of `currency`. */
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    /** It will not renew: it ends at `paidUntil`. */
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    /** The plugin that took the payment (`PaymentConnector.id`). */
    providerId: text('provider_id').notNull(),
    /** The provider's own subscription, when it has one: what a renewal's notice is matched by. */
    providerReference: text('provider_reference'),
    /** When the plugin was told this period passed unpaid - once per period. */
    dueNotifiedAt: timestamp('due_notified_at'),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
  },
  (table) => [
    index('payment_subscriptions_status_idx').on(table.status, table.paidUntil),
    index('payment_subscriptions_reference_idx').on(table.providerId, table.providerReference),
  ],
);

/** An attempt to pay for a plan: opened by the person, closed by what the provider reports. */
export const paymentCheckouts = table(
  'payment_checkouts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    tierId: text('tier_id').notNull(),
    /** The name when it was asked: a plan renamed or deleted later does not rewrite what was bought. */
    tierName: text('tier_name').notNull(),
    interval: text('interval', { enum: BILLING_INTERVALS }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    methodId: text('method_id').notNull(),
    status: text('status', { enum: CHECKOUT_STATUSES }).notNull(),
    providerId: text('provider_id').notNull(),
    providerReference: text('provider_reference'),
    /** What the person has to do next (an address to open, a text to follow) - never a way to pay. */
    action: json('action'),
    failureReason: text('failure_reason'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
  },
  (table) => [
    index('payment_checkouts_user_idx').on(table.userId, table.createdAt),
    index('payment_checkouts_reference_idx').on(table.providerId, table.providerReference),
  ],
);

/**
 * The ledger: every notice the provider sent that mattered, and what the server did with it. Also what makes
 * a notice that arrives twice (providers retry) count once: `(provider_id, provider_event_id)` is unique.
 */
export const paymentEvents = table(
  'payment_events',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id').notNull(),
    /** The provider's id for the notice; null for what the server noted itself (a period that passed unpaid). */
    providerEventId: text('provider_event_id'),
    kind: text('kind', { enum: PAYMENT_LEDGER_KINDS }).notNull(),
    userId: text('user_id'),
    tierName: text('tier_name'),
    amountCents: integer('amount_cents'),
    currency: text('currency'),
    providerReference: text('provider_reference'),
    /** Short and free of anything personal. */
    detail: text('detail'),
    createdAt: timestampNow('created_at'),
  },
  (table) => [
    uniqueIndex('payment_events_provider_event_unique').on(table.providerId, table.providerEventId),
    index('payment_events_created_idx').on(table.createdAt),
    index('payment_events_user_idx').on(table.userId, table.createdAt),
  ],
);

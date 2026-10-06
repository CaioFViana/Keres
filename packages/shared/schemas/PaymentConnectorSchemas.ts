import { z } from 'zod';
import { BILLING_INTERVALS } from '../metadata/Payments';
import { CONNECTOR_API_VERSION, CONNECTOR_CAPABILITIES } from '../payments/PaymentConnector';

/**
 * The messages between Keres and a payment connector, as they travel (JSON). Keres validates everything a connector
 * sends with these before it uses any of it, and the same shapes are published as JSON Schema
 * (`docs/payment_connector/`) for the connector's author, in any language - a connector imports nothing of Keres.
 *
 * Every text is bounded: the connector speaks for a provider, and what it says ends up in the database and on
 * screens, so it is held to sizes a payment never needs to exceed.
 */

const reference = z.string().min(1).max(200);

/** A connector's id is kept with every subscription: short, lower case, stable. */
export const CONNECTOR_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** `GET /v1/info`: who the connector is, which contract it implements and which optional parts it has. */
export const ConnectorInfoSchema = z.object({
  apiVersion: z.literal(CONNECTOR_API_VERSION),
  id: z.string().regex(CONNECTOR_ID_PATTERN),
  displayName: z.string().trim().min(1).max(80),
  capabilities: z
    .array(z.enum(CONNECTOR_CAPABILITIES))
    .max(CONNECTOR_CAPABILITIES.length)
    .default([]),
});
export type ConnectorInfo = z.infer<typeof ConnectorInfoSchema>;

/**
 * One way to pay. `flow` tells the client how the method is executed: a `redirect` method opens a
 * provider page (web checkout), a `native` one is bought inside the mobile app through the device's
 * store (`store`). It defaults to `redirect`, so a connector that predates the field keeps working
 * and stays visible wherever web checkouts run.
 */
export const PaymentMethodOptionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
  recurring: z.boolean().optional(),
  flow: z.enum(['redirect', 'native']).optional().default('redirect'),
  store: z.enum(['play', 'appstore']).optional(),
});

/** `GET /v1/methods`. */
export const ConnectorMethodsResponseSchema = z.object({
  methods: z.array(PaymentMethodOptionSchema).max(20),
});

/** What the person has to do next. The texts are clipped again by Keres; this only refuses what is absurd. */
export const PaymentActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('redirect'), url: z.string().min(1).max(2048) }),
  z.object({
    kind: z.literal('instructions'),
    title: z.string().min(1).max(500),
    text: z.string().min(1).max(5000),
    copyText: z.string().max(2000).optional(),
  }),
  z.object({ kind: z.literal('none') }),
]);

/** `POST /v1/checkouts` answer. */
export const CheckoutResultWireSchema = z.object({
  providerReference: reference,
  action: PaymentActionSchema,
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});

const optionalReference = reference.optional();

/**
 * What names a subscription at its provider. A store purchase token is the reference of a store
 * subscription and can run to 1000 characters (the same bound the verify request puts on it), far
 * past the 200 any other id needs.
 */
const subscriptionReference = z.string().min(1).max(1000);

/** One thing the provider reported, in Keres' terms. `paidAt` is an ISO date-time. */
export const PaymentEventWireSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('payment.succeeded'),
    eventId: reference,
    checkoutId: optionalReference,
    subscriptionReference: subscriptionReference.optional(),
    paidAt: z.iso.datetime({ offset: true }),
    amountCents: z.number().int().nonnegative().max(1_000_000_000),
    currency: z.string().length(3),
  }),
  z.object({
    type: z.literal('payment.failed'),
    eventId: reference,
    checkoutId: optionalReference,
    subscriptionReference: subscriptionReference.optional(),
    reason: z.string().max(200).optional(),
  }),
  z.object({
    type: z.literal('subscription.canceled'),
    eventId: reference,
    subscriptionReference,
  }),
  z.object({
    type: z.literal('checkout.expired'),
    eventId: reference,
    checkoutId: reference,
  }),
]);
export type PaymentEventWire = z.infer<typeof PaymentEventWireSchema>;

/** The most events one request may carry. */
export const MAX_EVENTS_PER_REQUEST = 100;

/** `POST /api/payments/events`, from the connector to Keres. */
export const PaymentEventsRequestSchema = z.object({
  events: z.array(PaymentEventWireSchema).max(MAX_EVENTS_PER_REQUEST),
});

/** `GET /v1/checkouts/:id` answer: how the attempt ended, or `null` while it is open. */
export const CheckoutStatusResponseSchema = z.object({
  event: PaymentEventWireSchema.nullable(),
});

/**
 * `POST /v1/play/verify` request: Keres asks the connector whether a store purchase token is a real,
 * paid purchase. `amountCents`/`currency` are what the plan costs here (never what the app said); the
 * connector checks the token with the store and reports the fact as an event, naming this attempt.
 */
export const PlayVerifyRequestSchema = z.object({
  userId: z.string().min(1),
  packageName: z.string().min(1).max(200),
  productId: z.string().min(1).max(200),
  purchaseToken: z.string().min(1).max(1000),
  purchaseKind: z.enum(['inapp', 'subscription']),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  checkoutId: z.string().min(1).max(64).optional(),
});
export type PlayVerifyRequestWire = z.infer<typeof PlayVerifyRequestSchema>;

/**
 * `POST /v1/play/verify` answer. Behind the Play Bearer, not the signed protocol - the caller holds
 * the endpoint secret, and the purchase itself is reported as a signed event, not in this answer.
 */
export const PlayVerifyResponseSchema = z.object({
  ok: z.literal(true),
  active: z.boolean(),
  orderId: z.string().max(200).optional(),
});
export type PlayVerifyResponseWire = z.infer<typeof PlayVerifyResponseSchema>;

/**
 * `POST /api/payments/play/verify` request, from the app. The user comes from the session and the
 * price from the tier - the app only names the plan, the period, the store product it bought and the
 * purchase token, all of which the server checks before asking the connector.
 */
export const PlayRelayRequestSchema = z.object({
  tierId: z.string().min(1).max(64),
  interval: z.enum(BILLING_INTERVALS),
  productId: z.string().min(1).max(200),
  purchaseToken: z.string().min(1).max(1000),
  packageName: z.string().min(1).max(200),
});
export type PlayRelayRequest = z.infer<typeof PlayRelayRequestSchema>;

/** `POST /v1/checkouts` request. The same fields as `CheckoutRequest`. */
export const CheckoutRequestWireSchema = z.object({
  checkoutId: z.string().min(1).max(64),
  payer: z.object({ userId: z.string().min(1), username: z.string().max(200) }),
  tier: z.object({ id: z.string().min(1), name: z.string().max(200) }),
  interval: z.enum(BILLING_INTERVALS),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  methodId: z.string().min(1).max(64),
  language: z.string().min(2).max(8),
});

/** `POST /v1/subscriptions/due` request. */
export const DueSubscriptionWireSchema = z.object({
  payer: z.object({ userId: z.string().min(1), username: z.string().max(200) }),
  tier: z.object({ id: z.string().min(1), name: z.string().max(200) }),
  interval: z.enum(BILLING_INTERVALS),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  subscriptionReference: subscriptionReference.optional(),
  paidUntil: z.iso.datetime({ offset: true }),
});

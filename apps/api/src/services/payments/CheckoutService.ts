import type { Checkout, CheckoutCreate, PlayRelayRequest, PlayRelayResponse } from '@keres/shared';
import { CHECKOUT_DEFAULT_LIFETIME_HOURS } from '@keres/shared/metadata/Payments';
import type {
  CheckoutResult,
  PaymentAction,
  PaymentConnector,
} from '@keres/shared/payments/PaymentConnector';
import { and, count, eq, gt, gte, inArray } from 'drizzle-orm';
import { ulid } from 'ulid';
import { env } from '../../config/env';
import { db } from '../../db';
import { paymentCheckouts, tiers, users } from '../../db/schema';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { registrationSettingsService } from '../RegistrationSettingsService';
import { getPaymentConnector } from './PaymentConnectorRegistry';
import { claimPurchaseToken } from './playPurchaseClaims';
import { subscriptionService } from './SubscriptionService';

type CheckoutRow = typeof paymentCheckouts.$inferSelect;

/** Attempts one person may open in an hour: a person who is stuck is helped by the provider, not by retrying. */
export const MAX_CHECKOUTS_PER_HOUR = 10;
/**
 * Store token checks one person may ask for in a minute. Each relay call reaches the store, so
 * without a cap of its own a script could burn the store API quota with garbage tokens; the web
 * quota above does not cover the relay (a native retry must stay allowed, see `start`).
 */
export const MAX_RELAY_CALLS_PER_MINUTE = 5;
/** How soon the provider is asked again about the same attempt (for plugins that cannot rely on a webhook). */
const STATUS_POLL_MS = 5000;

const MAX_TITLE = 120;
const MAX_TEXT = 2000;
const MAX_COPY = 500;
const MAX_URL = 2048;

const lastPolled = new Map<string, number>();

/** Recent relay calls per person, as epoch milliseconds (single process, like `lastPolled`). */
const relayCalls = new Map<string, number[]>();

/** Whether the person may relay another store purchase now, recording the call. */
export function relayAllowed(userId: string, nowMs: number): boolean {
  if (relayCalls.size > 10000) {
    const cutoff = nowMs - 60 * 1000;
    for (const [other, calls] of relayCalls) {
      const kept = calls.filter((at) => at > cutoff);
      if (kept.length === 0) relayCalls.delete(other);
      else relayCalls.set(other, kept);
    }
  }
  const cutoff = nowMs - 60 * 1000;
  const calls = (relayCalls.get(userId) ?? []).filter((at) => at > cutoff);
  if (calls.length >= MAX_RELAY_CALLS_PER_MINUTE) {
    relayCalls.set(userId, calls);
    return false;
  }
  calls.push(nowMs);
  relayCalls.set(userId, calls);
  return true;
}

/**
 * What the plugin said to do, checked: a redirect is `https` (a plugin must not be able to send the person to
 * `javascript:` or to a local file), and every text is bounded. Anything else is the plugin's mistake. Plain `http`
 * is let through only when the operator says so (`PAYMENT_ALLOW_INSECURE_REDIRECTS`): for a connector on the developer's own machine.
 */
export function sanitizeAction(
  action: PaymentAction,
  options: { allowHttp?: boolean } = {},
): PaymentAction {
  switch (action.kind) {
    case 'none':
      return { kind: 'none' };
    case 'redirect': {
      let url: URL;
      try {
        url = new URL(action.url);
      } catch {
        throw new Error('The checkout address is not a valid URL.');
      }
      const allowed = url.protocol === 'https:' || (options.allowHttp && url.protocol === 'http:');
      if (!allowed || action.url.length > MAX_URL) {
        throw new Error('The checkout address must be an https URL.');
      }
      return { kind: 'redirect', url: url.toString() };
    }
    case 'instructions': {
      if (typeof action.title !== 'string' || typeof action.text !== 'string') {
        throw new Error('The payment instructions are incomplete.');
      }
      return {
        kind: 'instructions',
        title: action.title.slice(0, MAX_TITLE),
        text: action.text.slice(0, MAX_TEXT),
        ...(typeof action.copyText === 'string'
          ? { copyText: action.copyText.slice(0, MAX_COPY) }
          : {}),
      };
    }
    default:
      throw new Error('Unknown payment action.');
  }
}

function toWire(row: CheckoutRow): Checkout {
  return {
    id: row.id,
    status: row.status,
    tierId: row.tierId,
    tierName: row.tierName,
    interval: row.interval,
    amountCents: row.amountCents,
    currency: row.currency,
    methodId: row.methodId,
    action: row.status === 'pending' ? ((row.action as PaymentAction | null) ?? null) : null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    failureReason: row.failureReason,
  };
}

function requirePlugin(): PaymentConnector {
  const plugin = getPaymentConnector();
  if (!plugin) throw new AppError(404, 'Payments are not enabled on this server.');
  return plugin;
}

/**
 * Opening and following an attempt to pay for a plan. What is charged, and how, is decided here from the
 * plan's own price - never from what the client sends, which only picks a plan, how often, and a method.
 */
export class CheckoutService {
  async start(
    userId: string,
    input: CheckoutCreate,
    language: string,
    now = new Date(),
  ): Promise<Checkout> {
    const plugin = requirePlugin();
    const tier = await db.query.tiers.findFirst({ where: eq(tiers.id, input.tierId) });
    if (!tier || tier.isDeleted || !tier.isPublicForSale) {
      throw new AppError(404, 'That plan is not for sale.');
    }
    const price = input.interval === 'yearly' ? tier.priceYearlyCents : tier.priceMonthlyCents;
    if (!price || price <= 0) {
      throw new AppError(400, `That plan is not sold ${input.interval}.`);
    }
    const { currency } = await registrationSettingsService.getOrCreate();
    const methods = await Promise.resolve(plugin.listMethods(currency)).catch(() => []);
    const method = methods.find((candidate) => candidate.id === input.methodId);
    if (!method) {
      throw new AppError(400, 'That payment method is not available.');
    }
    const isNative = (method.flow ?? 'redirect') === 'native';
    if (!isNative) {
      // A web checkout only sells what the tier says is web-sold: the Play store's share is named
      // by the tier's product ids instead, and the relay checks that side itself.
      const webSold = input.interval === 'yearly' ? tier.webYearlyEnabled : tier.webMonthlyEnabled;
      if (!webSold) {
        throw new AppError(400, 'That plan is not sold on the web.');
      }
    } else {
      // Retrying a store purchase reuses its attempt for the plan instead of opening another:
      // the attempt only names what is being bought, so one live attempt per plan is enough - and a
      // script cannot grow the ledger by retrying. Pending attempts are picked up where they were;
      // paid ones make the retry idempotent (the event names the same attempt and dedupes, so the
      // plan is never granted twice). The price is refreshed in case it changed.
      const [open] = await db
        .update(paymentCheckouts)
        .set({
          amountCents: price,
          currency,
          expiresAt: new Date(now.getTime() + CHECKOUT_DEFAULT_LIFETIME_HOURS * 60 * 60 * 1000),
          updatedAt: now,
        })
        .where(
          and(
            eq(paymentCheckouts.userId, userId),
            eq(paymentCheckouts.tierId, tier.id),
            eq(paymentCheckouts.interval, input.interval),
            eq(paymentCheckouts.methodId, input.methodId),
            inArray(paymentCheckouts.status, ['pending', 'paid']),
            gt(paymentCheckouts.expiresAt, now),
          ),
        )
        .returning();
      if (open) return toWire(open);
    }

    // A store purchase keeps no provider session open (the token is checked at the relay, which
    // authenticates and verifies every call), so retrying one must not eat the hourly quota meant
    // to cap provider sessions. One open attempt per person still holds: opening another closes the
    // one before it below.
    if (!isNative) {
      const since = new Date(now.getTime() - 60 * 60 * 1000);
      const [{ recent }] = await db
        .select({ recent: count() })
        .from(paymentCheckouts)
        .where(and(eq(paymentCheckouts.userId, userId), gte(paymentCheckouts.createdAt, since)));
      if (recent >= MAX_CHECKOUTS_PER_HOUR) {
        throw new AppError(429, 'Too many payment attempts. Try again later.');
      }
    }

    // One open attempt at a time: opening another closes the one before it.
    await db
      .update(paymentCheckouts)
      .set({ status: 'expired', action: null, updatedAt: now })
      .where(and(eq(paymentCheckouts.userId, userId), eq(paymentCheckouts.status, 'pending')));

    const id = ulid();
    await db.insert(paymentCheckouts).values({
      id,
      userId,
      tierId: tier.id,
      tierName: tier.name,
      interval: input.interval,
      amountCents: price,
      currency,
      methodId: input.methodId,
      status: 'pending',
      providerId: plugin.id,
      createdAt: now,
      updatedAt: now,
    });

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { username: true },
    });
    if (isNative) {
      // The purchase happens in the app through the device's store: there is no provider page to
      // open, so the attempt waits for the token relay instead of a provider checkout.
      const [native] = await db
        .update(paymentCheckouts)
        .set({
          action: sanitizeAction({ kind: 'none' }),
          expiresAt: new Date(now.getTime() + CHECKOUT_DEFAULT_LIFETIME_HOURS * 60 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(paymentCheckouts.id, id))
        .returning();
      return toWire(native);
    }
    let result: CheckoutResult;
    let action: PaymentAction;
    try {
      result = await plugin.createCheckout({
        checkoutId: id,
        payer: { userId, username: user?.username ?? '' },
        tier: { id: tier.id, name: tier.name },
        interval: input.interval,
        amountCents: price,
        currency,
        methodId: input.methodId,
        language,
      });
      action = sanitizeAction(result.action, { allowHttp: env.PAYMENT_ALLOW_INSECURE_REDIRECTS });
    } catch (error) {
      logger.error('Payment plugin could not start a checkout', error);
      await db
        .update(paymentCheckouts)
        .set({
          status: 'failed',
          failureReason: 'Could not start the payment.',
          updatedAt: new Date(),
        })
        .where(eq(paymentCheckouts.id, id));
      throw new AppError(502, 'Could not start the payment. Try again later.');
    }

    const expiresAt =
      result.expiresAt ??
      new Date(now.getTime() + CHECKOUT_DEFAULT_LIFETIME_HOURS * 60 * 60 * 1000);
    const [row] = await db
      .update(paymentCheckouts)
      .set({
        providerReference: String(result.providerReference).slice(0, 200),
        action,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(paymentCheckouts.id, id))
      .returning();
    return toWire(row);
  }

  /**
   * Relays an in-app purchase: the app bought through the device's store and hands over the purchase
   * token; the server checks the plan and the price itself, names the attempt, and asks the connector
   * whether the token is real. The grant itself arrives as the connector's signed event (naming this
   * attempt), exactly like a web payment - this only reads the plan after it.
   */
  async verifyStorePurchase(
    userId: string,
    input: PlayRelayRequest,
    now = new Date(),
  ): Promise<PlayRelayResponse> {
    const plugin = requirePlugin();
    if (!plugin.verifyPlayPurchase) {
      throw new AppError(404, 'Store purchases are not enabled on this server.');
    }
    const tier = await db.query.tiers.findFirst({ where: eq(tiers.id, input.tierId) });
    if (!tier || tier.isDeleted || !tier.isPublicForSale) {
      throw new AppError(404, 'That plan is not for sale.');
    }
    const price = input.interval === 'yearly' ? tier.priceYearlyCents : tier.priceMonthlyCents;
    if (!price || price <= 0) {
      throw new AppError(400, `That plan is not sold ${input.interval}.`);
    }
    const expectedProduct =
      input.interval === 'yearly' ? tier.playYearlyProductId : tier.playMonthlyProductId;
    if (!expectedProduct || input.productId !== expectedProduct) {
      throw new AppError(400, 'That store product does not sell this plan.');
    }
    const { currency } = await registrationSettingsService.getOrCreate();
    const methods = await Promise.resolve(plugin.listMethods(currency)).catch(() => []);
    const method = methods.find(
      (candidate) =>
        (candidate.flow ?? 'redirect') === 'native' && (candidate.store ?? 'play') === 'play',
    );
    if (!method) {
      throw new AppError(400, 'That payment method is not available.');
    }
    if (!relayAllowed(userId, now.getTime())) {
      throw new AppError(429, 'Too many store purchase checks. Try again later.');
    }
    await claimPurchaseToken(userId, input.purchaseToken, input.productId);
    const checkout = await this.start(
      userId,
      { tierId: tier.id, interval: input.interval, methodId: method.id },
      'en',
      now,
    );
    let verification;
    try {
      verification = await plugin.verifyPlayPurchase({
        userId,
        packageName: input.packageName,
        productId: input.productId,
        purchaseToken: input.purchaseToken,
        purchaseKind: 'subscription',
        amountCents: price,
        currency,
        checkoutId: checkout.id,
      });
    } catch (error) {
      logger.error('Payment plugin could not check a store purchase', error);
      throw new AppError(502, 'Could not check the purchase. Try again later.');
    }
    if (!verification.active) {
      await db
        .update(paymentCheckouts)
        .set({
          status: 'failed',
          failureReason: 'The store did not confirm this purchase.',
          action: null,
          updatedAt: new Date(),
        })
        .where(eq(paymentCheckouts.id, checkout.id));
      return { active: false, subscription: null };
    }
    const subscription = await subscriptionService.findByUser(userId);
    return {
      active: true,
      subscription: subscription ? await subscriptionService.toWire(subscription, plugin) : null,
    };
  }

  /** An attempt of the person's own, brought up to date: expired when its time passed, asked about at the provider if it can be. */
  async get(userId: string, id: string, now = new Date()): Promise<Checkout> {
    let row = await db.query.paymentCheckouts.findFirst({
      where: and(eq(paymentCheckouts.id, id), eq(paymentCheckouts.userId, userId)),
    });
    if (!row) throw new AppError(404, 'Payment not found.');

    if (row.status === 'pending' && row.expiresAt && row.expiresAt <= now) {
      [row] = await db
        .update(paymentCheckouts)
        .set({ status: 'expired', action: null, updatedAt: now })
        .where(and(eq(paymentCheckouts.id, id), eq(paymentCheckouts.status, 'pending')))
        .returning();
      row ??= (await db.query.paymentCheckouts.findFirst({ where: eq(paymentCheckouts.id, id) }))!;
    }

    const plugin = getPaymentConnector();
    if (
      row.status === 'pending' &&
      row.providerReference &&
      plugin?.getCheckoutStatus &&
      plugin.id === row.providerId &&
      now.getTime() - (lastPolled.get(id) ?? 0) >= STATUS_POLL_MS
    ) {
      lastPolled.set(id, now.getTime());
      try {
        const event = await plugin.getCheckoutStatus(id, row.providerReference);
        if (event) {
          await subscriptionService.applyEvent(plugin, event, now);
          row =
            (await db.query.paymentCheckouts.findFirst({ where: eq(paymentCheckouts.id, id) })) ??
            row;
        }
      } catch (error) {
        logger.error('Payment plugin could not report on a checkout', error);
      }
    }
    return toWire(row);
  }
}

export const checkoutService = new CheckoutService();

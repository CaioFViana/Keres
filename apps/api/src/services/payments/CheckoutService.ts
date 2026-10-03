import type { Checkout, CheckoutCreate } from '@keres/shared';
import { CHECKOUT_DEFAULT_LIFETIME_HOURS } from '@keres/shared/metadata/Payments';
import type {
  CheckoutResult,
  PaymentAction,
  PaymentPlugin,
} from '@keres/shared/payments/PaymentPlugin';
import { and, count, eq, gte } from 'drizzle-orm';
import { ulid } from 'ulid';
import { env } from '../../config/env';
import { db } from '../../db';
import { paymentCheckouts, tiers, users } from '../../db/schema';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { registrationSettingsService } from '../RegistrationSettingsService';
import { getPaymentPlugin } from './PaymentPluginRegistry';
import { subscriptionService } from './SubscriptionService';

type CheckoutRow = typeof paymentCheckouts.$inferSelect;

/** Attempts one person may open in an hour: a person who is stuck is helped by the provider, not by retrying. */
export const MAX_CHECKOUTS_PER_HOUR = 10;
/** How soon the provider is asked again about the same attempt (for plugins that cannot rely on a webhook). */
const STATUS_POLL_MS = 5000;

const MAX_TITLE = 120;
const MAX_TEXT = 2000;
const MAX_COPY = 500;
const MAX_URL = 2048;

const lastPolled = new Map<string, number>();

/**
 * What the plugin said to do, checked: a redirect is `https` (a plugin must not be able to send the person to
 * `javascript:` or to a local file), and every text is bounded. Anything else is the plugin's mistake. Plain `http`
 * is let through only for the demo provider (`PAYMENT_DEMO`), whose page is on the developer's own machine.
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

function requirePlugin(): PaymentPlugin {
  const plugin = getPaymentPlugin();
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
    if (!methods.some((method) => method.id === input.methodId)) {
      throw new AppError(400, 'That payment method is not available.');
    }

    const since = new Date(now.getTime() - 60 * 60 * 1000);
    const [{ recent }] = await db
      .select({ recent: count() })
      .from(paymentCheckouts)
      .where(and(eq(paymentCheckouts.userId, userId), gte(paymentCheckouts.createdAt, since)));
    if (recent >= MAX_CHECKOUTS_PER_HOUR) {
      throw new AppError(429, 'Too many payment attempts. Try again later.');
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
      action = sanitizeAction(result.action, { allowHttp: env.PAYMENT_DEMO });
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

    const plugin = getPaymentPlugin();
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

import type { PaymentsInfo, Subscription, SwitchQuote } from '@keres/shared';
import { addBillingPeriod } from '@keres/shared/utils/billingPeriod';
import type {
  BillingInterval,
  PaymentEvent,
  PaymentMethodOption,
  PaymentConnector,
} from '@keres/shared/payments/PaymentConnector';
import { GIFT_PROVIDER_ID } from '@keres/shared/metadata/Payments';
import { and, desc, eq, inArray, lte } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, withWriteTransaction } from '../../db';
import {
  paymentCheckouts,
  paymentEvents,
  paymentSubscriptions,
  tiers,
  users,
} from '../../db/schema';
import { emitUserEvent } from '../../modules/webSocket/webSocket.route';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { auditService } from '../AuditService';
import { registrationSettingsService } from '../RegistrationSettingsService';
import { clipDetail as clip, noteLedger, tierNameOf } from './paymentLedger';
import { getPaymentConnector } from './PaymentConnectorRegistry';
import { periodStartFor } from './periodConversion';

type SubscriptionRow = typeof paymentSubscriptions.$inferSelect;

/** A period left unpaid this long ends the subscription for good: the administrators' list does not fill with them. */
export const DUE_ABANDONED_AFTER_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export type EventOutcome = 'applied' | 'duplicate' | 'unmatched';

/**
 * Who has paid for what, and until when.
 *
 * Keres never charges: the provider (through the plugin) does, and tells this server what happened. This
 * keeps that state - a subscription per person with the date up to which it is paid - and applies the
 * provider's notices to it. The rules, from what the operator asked for:
 *   - a month paid on the 3rd lasts until the 3rd of the next month (`addBillingPeriod`);
 *   - a payment that comes before that date extends from it, so paying early loses nothing; one that comes
 *     after starts from the payment, so a late payment does not buy time that already went by;
 *   - when the date passes with no payment the subscription is marked `due` (to be charged), the plan is no
 *     longer granted and the plugin is told once, in case its provider needs a nudge.
 *
 * None of it holds a way to pay: see `db/schema/tables/payments.ts`.
 */
export class SubscriptionService {
  async findByUser(userId: string): Promise<SubscriptionRow | undefined> {
    return db.query.paymentSubscriptions.findFirst({
      where: eq(paymentSubscriptions.userId, userId),
    });
  }

  /**
   * Whether the provider charges this subscription again by itself. The subscription does not keep the method it
   * was paid with; the person's last paid attempt does, and the plugin says whether that method is recurring (a
   * saved card is, PIX and boleto are not). A plugin that does not say, or a subscription with no attempt behind
   * it, counts as recurring: what the app showed before this was known.
   */
  private async autoRenews(
    row: SubscriptionRow,
    plugin: PaymentConnector | null,
    knownMethods?: PaymentMethodOption[],
  ): Promise<boolean> {
    // A plan given by hand is not charged by anybody: the person has to pay for what comes after it.
    if (row.providerId === GIFT_PROVIDER_ID) return false;
    if (!plugin) return true;
    const last = await db.query.paymentCheckouts.findFirst({
      where: and(
        eq(paymentCheckouts.userId, row.userId),
        eq(paymentCheckouts.status, 'paid'),
        eq(paymentCheckouts.providerId, row.providerId),
      ),
      orderBy: desc(paymentCheckouts.updatedAt),
      columns: { methodId: true },
    });
    if (!last) return true;
    const methods =
      knownMethods ??
      (await Promise.resolve(plugin.listMethods(row.currency)).catch(
        () => [] as PaymentMethodOption[],
      ));
    return methods.find((method) => method.id === last.methodId)?.recurring ?? true;
  }

  async toWire(
    row: SubscriptionRow,
    plugin: PaymentConnector | null,
    knownMethods?: PaymentMethodOption[],
  ): Promise<Subscription> {
    return {
      tierId: row.tierId,
      tierName: await tierNameOf(row.tierId),
      interval: row.interval,
      status: row.status,
      paidUntil: row.paidUntil.toISOString(),
      lastPaymentAt: row.lastPaymentAt?.toISOString() ?? null,
      amountCents: row.amountCents,
      currency: row.currency,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      canCancelHere: Boolean(
        plugin?.cancelSubscription && row.providerReference && row.providerId === plugin.id,
      ),
      autoRenews: await this.autoRenews(row, plugin, knownMethods),
      complimentary: row.providerId === GIFT_PROVIDER_ID,
    };
  }

  /** What the server says about payments to a person: whether it sells plans, how, and where they stand. */
  async getInfo(userId: string): Promise<PaymentsInfo> {
    const plugin = getPaymentConnector();
    const { currency } = await registrationSettingsService.getOrCreate();
    if (!plugin) {
      return { enabled: false, provider: null, currency, methods: [], subscription: null };
    }
    const [methods, row] = await Promise.all([
      Promise.resolve(plugin.listMethods(currency)).catch((error: unknown) => {
        logger.error('Payment plugin could not list its methods', error);
        return [];
      }),
      this.findByUser(userId),
    ]);
    return {
      enabled: true,
      provider: { id: plugin.id, displayName: plugin.displayName },
      currency,
      methods,
      subscription: row ? await this.toWire(row, plugin, methods) : null,
    };
  }

  /** Stops the subscription renewing: it runs out its last paid period and ends. */
  async cancel(userId: string): Promise<Subscription> {
    const plugin = getPaymentConnector();
    const row = await this.findByUser(userId);
    if (!plugin || !row || row.status !== 'active') {
      throw new AppError(404, 'There is no active subscription to cancel.');
    }
    if (row.cancelAtPeriodEnd) {
      return this.toWire(row, plugin);
    }
    if (plugin.cancelSubscription && row.providerReference && row.providerId === plugin.id) {
      try {
        await plugin.cancelSubscription(row.providerReference);
      } catch (error) {
        logger.error('Payment plugin could not cancel a subscription', error);
        throw new AppError(502, 'Could not cancel the subscription now. Try again later.');
      }
    }
    const [updated] = await db
      .update(paymentSubscriptions)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(paymentSubscriptions.userId, userId))
      .returning();
    await db.insert(paymentEvents).values({
      id: ulid(),
      providerId: row.providerId,
      kind: 'subscription_canceled',
      userId,
      tierName: await tierNameOf(row.tierId),
      providerReference: row.providerReference,
      detail: 'Asked by the user; it ends when the paid period does.',
    });
    this.notify(userId);
    auditService.record({
      category: 'payment',
      action: 'payment.subscription_canceled',
      subjectUserId: userId,
      meta: { by: 'user' },
    });
    return this.toWire(updated, plugin);
  }

  private notify(userId: string): void {
    emitUserEvent(userId, { type: 'payments.changed' });
  }

  /**
   * What changing to another plan would do to the time the person has left, said before they pay: the same
   * conversion the payment will apply, so the app can show it. Null when nothing converts (no running
   * subscription, or the same plan).
   */
  async quoteSwitch(
    userId: string,
    tierId: string,
    interval: BillingInterval,
    now = new Date(),
  ): Promise<SwitchQuote | null> {
    const existing = await this.findByUser(userId);
    if (!existing || existing.status !== 'active' || existing.paidUntil <= now) return null;
    if (existing.tierId === tierId) return null;
    const tier = await db.query.tiers.findFirst({ where: eq(tiers.id, tierId) });
    const price = interval === 'yearly' ? tier?.priceYearlyCents : tier?.priceMonthlyCents;
    if (!tier || !price || price <= 0) return null;
    const { conversion } = await periodStartFor(
      db,
      existing,
      { tierId, interval, amountCents: price },
      now,
    );
    return conversion ? { ...conversion, toTierName: tier.name } : null;
  }

  /**
   * Applies what the provider reported. Each notice is applied once whatever the number of times it arrives:
   * the ledger line and the change it causes are written together, and the ledger refuses a notice id it has.
   */
  async applyEvents(plugin: PaymentConnector, events: PaymentEvent[], now = new Date()) {
    const outcomes: EventOutcome[] = [];
    for (const event of events) {
      outcomes.push(await this.applyEvent(plugin, event, now));
    }
    return outcomes;
  }

  async applyEvent(
    plugin: PaymentConnector,
    event: PaymentEvent,
    now = new Date(),
  ): Promise<EventOutcome> {
    let affectedUser: string | null = null;
    const audit: { action: string; meta: Record<string, unknown> }[] = [];

    const outcome = await withWriteTransaction(async (tx): Promise<EventOutcome> => {
      const base = { providerId: plugin.id, providerEventId: event.eventId };
      const checkout =
        'checkoutId' in event && event.checkoutId
          ? await tx.query.paymentCheckouts.findFirst({
              where: eq(paymentCheckouts.id, event.checkoutId),
            })
          : undefined;
      const subscriptionReference =
        'subscriptionReference' in event ? event.subscriptionReference : undefined;
      const bySubscription = subscriptionReference
        ? await tx.query.paymentSubscriptions.findFirst({
            where: and(
              eq(paymentSubscriptions.providerId, plugin.id),
              eq(paymentSubscriptions.providerReference, subscriptionReference),
            ),
          })
        : undefined;
      const userId = checkout?.userId ?? bySubscription?.userId ?? null;

      if (!userId) {
        // A notice for something this server never opened (another environment, a deleted attempt): kept in
        // the ledger so an administrator can see it arrived, and nothing changes.
        const fresh = await noteLedger(tx, {
          ...base,
          kind: event.type === 'payment.succeeded' ? 'payment_succeeded' : 'payment_failed',
          detail: `Unmatched ${event.type}`,
          providerReference: subscriptionReference ?? null,
        });
        return fresh ? 'unmatched' : 'duplicate';
      }
      affectedUser = userId;
      const existing =
        bySubscription ??
        (await tx.query.paymentSubscriptions.findFirst({
          where: eq(paymentSubscriptions.userId, userId),
        }));

      switch (event.type) {
        case 'payment.succeeded': {
          const tierId = checkout?.tierId ?? existing?.tierId;
          const interval = checkout?.interval ?? existing?.interval;
          if (!tierId || !interval) return 'unmatched';
          const tierName = checkout?.tierName ?? (await tierNameOf(tierId));
          const { start, conversion } = await periodStartFor(
            tx,
            existing,
            { tierId, interval, amountCents: event.amountCents },
            event.paidAt,
          );
          const fresh = await noteLedger(tx, {
            ...base,
            kind: 'payment_succeeded',
            userId,
            tierName,
            amountCents: event.amountCents,
            currency: event.currency,
            providerReference: subscriptionReference ?? checkout?.providerReference ?? null,
            detail: conversion
              ? `Changed from ${conversion.fromTierName}: ${conversion.remainingDays} day(s) left became ${conversion.convertedDays}.`
              : null,
          });
          if (!fresh) return 'duplicate';
          const values = {
            tierId,
            interval,
            status: 'active' as const,
            paidUntil: addBillingPeriod(start, interval),
            lastPaymentAt: event.paidAt,
            amountCents: event.amountCents,
            currency: event.currency,
            cancelAtPeriodEnd: false,
            providerId: plugin.id,
            providerReference: subscriptionReference ?? existing?.providerReference ?? null,
            dueNotifiedAt: null,
            updatedAt: now,
          };
          await tx
            .insert(paymentSubscriptions)
            .values({ userId, ...values })
            .onConflictDoUpdate({ target: paymentSubscriptions.userId, set: values });
          if (checkout && checkout.status !== 'paid') {
            await tx
              .update(paymentCheckouts)
              .set({ status: 'paid', failureReason: null, action: null, updatedAt: now })
              .where(eq(paymentCheckouts.id, checkout.id));
          }
          audit.push({
            action: 'payment.succeeded',
            meta: {
              tier: tierName,
              interval,
              amountCents: event.amountCents,
              ...(conversion ? { changedFrom: conversion.fromTierName } : {}),
            },
          });
          return 'applied';
        }
        case 'payment.failed': {
          const fresh = await noteLedger(tx, {
            ...base,
            kind: 'payment_failed',
            userId,
            tierName: checkout?.tierName ?? (existing ? await tierNameOf(existing.tierId) : null),
            providerReference: subscriptionReference ?? checkout?.providerReference ?? null,
            detail: event.reason,
          });
          if (!fresh) return 'duplicate';
          if (checkout && checkout.status === 'pending') {
            await tx
              .update(paymentCheckouts)
              .set({
                status: 'failed',
                failureReason: clip(event.reason),
                action: null,
                updatedAt: now,
              })
              .where(eq(paymentCheckouts.id, checkout.id));
          }
          audit.push({ action: 'payment.failed', meta: { reason: clip(event.reason) } });
          return 'applied';
        }
        case 'subscription.canceled': {
          if (!existing) return 'unmatched';
          const fresh = await noteLedger(tx, {
            ...base,
            kind: 'subscription_canceled',
            userId,
            tierName: await tierNameOf(existing.tierId),
            providerReference: existing.providerReference,
            detail: 'Canceled at the provider.',
          });
          if (!fresh) return 'duplicate';
          // What was paid stays paid: it ends when the period does (or now, if it already had).
          await tx
            .update(paymentSubscriptions)
            .set({
              cancelAtPeriodEnd: true,
              status: existing.status === 'due' ? 'canceled' : existing.status,
              updatedAt: now,
            })
            .where(eq(paymentSubscriptions.userId, userId));
          audit.push({ action: 'payment.subscription_canceled', meta: { by: 'provider' } });
          return 'applied';
        }
        case 'checkout.expired': {
          if (!checkout) return 'unmatched';
          const fresh = await noteLedger(tx, {
            ...base,
            kind: 'checkout_expired',
            userId,
            tierName: checkout.tierName,
            providerReference: checkout.providerReference,
          });
          if (!fresh) return 'duplicate';
          if (checkout.status === 'pending') {
            await tx
              .update(paymentCheckouts)
              .set({ status: 'expired', action: null, updatedAt: now })
              .where(eq(paymentCheckouts.id, checkout.id));
          }
          return 'applied';
        }
      }
    });

    if (outcome === 'applied' && affectedUser) {
      this.notify(affectedUser);
      for (const line of audit) {
        auditService.record({
          category: 'payment',
          action: line.action,
          subjectUserId: affectedUser,
          meta: line.meta,
        });
      }
    }
    return outcome;
  }

  /**
   * Marks the subscriptions whose paid period ran out. A cancelled one ends; any other becomes `due`, the
   * plugin is told once so its provider can chase it, and one left unpaid for `DUE_ABANDONED_AFTER_DAYS`
   * ends too. Safe to run as often as wanted - it only acts on what changed.
   */
  async markDue(now = new Date()): Promise<{ due: number; ended: number }> {
    const plugin = getPaymentConnector();
    let due = 0;
    let ended = 0;

    const lapsed = await db
      .select()
      .from(paymentSubscriptions)
      .where(
        and(eq(paymentSubscriptions.status, 'active'), lte(paymentSubscriptions.paidUntil, now)),
      );
    for (const row of lapsed) {
      const tierName = await tierNameOf(row.tierId);
      const ending = row.cancelAtPeriodEnd;
      const done = await withWriteTransaction(async (tx) => {
        // The row may have been paid since it was read: only a still-active, still-lapsed one changes.
        const changed = await tx
          .update(paymentSubscriptions)
          .set({ status: ending ? 'canceled' : 'due', updatedAt: now })
          .where(
            and(
              eq(paymentSubscriptions.userId, row.userId),
              eq(paymentSubscriptions.status, 'active'),
              lte(paymentSubscriptions.paidUntil, now),
            ),
          )
          .returning({ userId: paymentSubscriptions.userId });
        if (changed.length === 0) return false;
        await noteLedger(tx, {
          providerId: row.providerId,
          kind: ending ? 'subscription_canceled' : 'subscription_due',
          userId: row.userId,
          tierName,
          amountCents: row.amountCents,
          currency: row.currency,
          providerReference: row.providerReference,
          detail: ending ? 'The paid period ended.' : `Paid until ${row.paidUntil.toISOString()}.`,
        });
        return true;
      });
      if (!done) continue;
      if (ending) ended += 1;
      else due += 1;
      this.notify(row.userId);
      auditService.record({
        category: 'payment',
        action: ending ? 'payment.subscription_canceled' : 'payment.subscription_due',
        subjectUserId: row.userId,
        meta: { tier: tierName, paidUntil: row.paidUntil.toISOString() },
      });
    }

    const waiting = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.status, 'due'));
    for (const row of waiting) {
      if (now.getTime() - row.paidUntil.getTime() > DUE_ABANDONED_AFTER_DAYS * DAY_MS) {
        await db
          .update(paymentSubscriptions)
          .set({ status: 'canceled', updatedAt: now })
          .where(
            and(
              eq(paymentSubscriptions.userId, row.userId),
              eq(paymentSubscriptions.status, 'due'),
            ),
          );
        await db.insert(paymentEvents).values({
          id: ulid(),
          providerId: row.providerId,
          kind: 'subscription_canceled',
          userId: row.userId,
          tierName: await tierNameOf(row.tierId),
          providerReference: row.providerReference,
          detail: `Unpaid for ${DUE_ABANDONED_AFTER_DAYS} days.`,
        });
        ended += 1;
        this.notify(row.userId);
        continue;
      }
      if (row.dueNotifiedAt || !plugin?.onSubscriptionDue || row.providerId !== plugin.id) continue;
      try {
        const user = await db.query.users.findFirst({
          where: eq(users.id, row.userId),
          columns: { id: true, username: true },
        });
        await plugin.onSubscriptionDue({
          payer: { userId: row.userId, username: user?.username ?? '' },
          tier: { id: row.tierId, name: await tierNameOf(row.tierId) },
          interval: row.interval,
          amountCents: row.amountCents,
          currency: row.currency,
          subscriptionReference: row.providerReference ?? undefined,
          paidUntil: row.paidUntil,
        });
        await db
          .update(paymentSubscriptions)
          .set({ dueNotifiedAt: now })
          .where(eq(paymentSubscriptions.userId, row.userId));
      } catch (error) {
        // Retried on the next run; the plan is already not granted, so nothing depends on it.
        logger.error('Payment plugin failed on a subscription that is due', error);
      }
    }

    // Attempts nobody finished stop being payable.
    const open = await db
      .select({ id: paymentCheckouts.id })
      .from(paymentCheckouts)
      .where(and(eq(paymentCheckouts.status, 'pending'), lte(paymentCheckouts.expiresAt, now)));
    if (open.length > 0) {
      await db
        .update(paymentCheckouts)
        .set({ status: 'expired', action: null, updatedAt: now })
        .where(
          inArray(
            paymentCheckouts.id,
            open.map((row) => row.id),
          ),
        );
    }
    return { due, ended };
  }
}

export const subscriptionService = new SubscriptionService();

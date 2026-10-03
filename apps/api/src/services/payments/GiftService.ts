import type { AdminGiftCreate } from '@keres/shared';
import { GIFT_PROVIDER_ID } from '@keres/shared/metadata/Payments';
import {
  addBillingMonths,
  convertedPeriodStart,
  dailyCents,
  wholeDays,
} from '@keres/shared/utils/billingPeriod';
import { eq } from 'drizzle-orm';
import { db, withWriteTransaction } from '../../db';
import { paymentSubscriptions, tiers, users } from '../../db/schema';
import { emitUserEvent } from '../../modules/webSocket/webSocket.route';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { auditService } from '../AuditService';
import { registrationSettingsService } from '../RegistrationSettingsService';
import { noteLedger } from './paymentLedger';
import { getPaymentConnector } from './PaymentConnectorRegistry';
import { dailyValueOf } from './periodConversion';
import { subscriptionService } from './SubscriptionService';

type Giver = { id: string; username: string };

/**
 * A plan given by an administrator: a period paid for with nothing, by the rules of one paid for with money.
 *
 *   - for the plan the person is already on, it extends the running period from where it ends (or starts one
 *     now, when none is running) - "a month free" is exactly a payment of zero;
 *   - for another plan, it switches at once and the time left is converted by value, as it is when the person
 *     pays for the change (see `convertedPeriodStart`);
 *   - nothing charges it, so it never renews: it ends on its date, and whatever the person pays for afterwards
 *     starts from there.
 *
 * What cannot be done silently is giving a different plan to somebody a provider is still charging for the old
 * one - the provider would go on charging the old price for what would now be the new plan. That needs the
 * renewal cancelled first, and the administrator's word (`consent`) that the person agreed to it.
 */
export class GiftService {
  async grant(giver: Giver, userId: string, input: AdminGiftCreate, now = new Date()) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, username: true, isDeleted: true },
    });
    if (!user || user.isDeleted) throw new AppError(404, 'User not found.');
    const tier = await db.query.tiers.findFirst({ where: eq(tiers.id, input.tierId) });
    if (!tier || tier.isDeleted) throw new AppError(404, 'Plan not found.');

    const before = await subscriptionService.findByUser(userId);
    const plugin = getPaymentConnector();
    // A provider that may still charge the person, for a plan other than the one being given.
    const chargedElsewhere =
      !!before &&
      before.providerId !== GIFT_PROVIDER_ID &&
      !!before.providerReference &&
      before.status !== 'canceled' &&
      !before.cancelAtPeriodEnd &&
      before.tierId !== tier.id;
    if (chargedElsewhere) {
      if (!input.cancelRenewal) {
        throw new AppError(
          409,
          `${user.username} has a paid subscription that is still being charged. Cancel its renewal with the person's consent, or give the plan they pay for.`,
        );
      }
      if (!input.consent) {
        throw new AppError(
          400,
          'Cancelling a renewal needs the confirmation that the person agreed to it.',
        );
      }
      if (plugin?.cancelSubscription && before.providerId === plugin.id) {
        try {
          await plugin.cancelSubscription(before.providerReference!);
        } catch (error) {
          logger.error('Payment plugin could not cancel a subscription for a gift', error);
          throw new AppError(
            502,
            'Could not cancel the subscription at the provider. Nothing was changed.',
          );
        }
      }
    }

    const { currency } = await registrationSettingsService.getOrCreate();
    const outcome = await withWriteTransaction(async (tx) => {
      const current = await tx.query.paymentSubscriptions.findFirst({
        where: eq(paymentSubscriptions.userId, userId),
      });
      const running = !!current && current.status === 'active' && current.paidUntil > now;
      const sameTier = current?.tierId === tier.id;

      let start = now;
      let conversion: { fromTierId: string; remainingDays: number; convertedDays: number } | null =
        null;
      if (current && running) {
        if (sameTier) {
          start = current.paidUntil;
        } else {
          const listed = tier.priceMonthlyCents || (tier.priceYearlyCents ?? 0) / 12;
          // A plan with no price has nothing to value the time by: carried over as it is, which costs nothing.
          start =
            listed > 0
              ? convertedPeriodStart(
                  now,
                  current.paidUntil,
                  await dailyValueOf(tx, current),
                  dailyCents(listed, 'monthly'),
                )
              : current.paidUntil;
          conversion = {
            fromTierId: current.tierId,
            remainingDays: wholeDays(current.paidUntil.getTime() - now.getTime()),
            convertedDays: wholeDays(start.getTime() - now.getTime()),
          };
        }
      }
      const paidUntil = addBillingMonths(start, input.months);

      const asGift = {
        tierId: tier.id,
        interval: 'monthly' as const,
        status: 'active' as const,
        paidUntil,
        lastPaymentAt: current?.lastPaymentAt ?? null,
        amountCents: 0,
        currency: current?.currency ?? currency,
        cancelAtPeriodEnd: true,
        providerId: GIFT_PROVIDER_ID,
        providerReference: null,
        dueNotifiedAt: null,
        updatedAt: now,
      };
      if (!current) {
        await tx.insert(paymentSubscriptions).values({ userId, ...asGift });
      } else if (current.providerId !== GIFT_PROVIDER_ID && sameTier) {
        // The provider's own subscription for this plan stays as it is: it goes on being charged, and its
        // payments extend from where the gift ends.
        await tx
          .update(paymentSubscriptions)
          .set({
            status: 'active',
            paidUntil,
            dueNotifiedAt: null,
            cancelAtPeriodEnd: current.status === 'canceled' ? true : current.cancelAtPeriodEnd,
            updatedAt: now,
          })
          .where(eq(paymentSubscriptions.userId, userId));
      } else {
        await tx
          .update(paymentSubscriptions)
          .set(asGift)
          .where(eq(paymentSubscriptions.userId, userId));
      }

      const fromName = conversion
        ? (
            await tx.query.tiers.findFirst({
              where: eq(tiers.id, conversion.fromTierId),
              columns: { name: true },
            })
          )?.name
        : null;
      await noteLedger(tx, {
        providerId: GIFT_PROVIDER_ID,
        kind: 'gift_granted',
        userId,
        tierName: tier.name,
        amountCents: 0,
        currency: current?.currency ?? currency,
        detail:
          `${input.months} month(s) by ${giver.username}` +
          (conversion
            ? `; ${conversion.remainingDays} day(s) of ${fromName ?? 'the previous plan'} became ${conversion.convertedDays}`
            : ''),
      });
      return { paidUntil, conversion: conversion ? { ...conversion, fromName } : null };
    });

    emitUserEvent(userId, { type: 'payments.changed' });
    auditService.record({
      category: 'payment',
      action: 'payment.gift_granted',
      actorUserId: giver.id,
      actorUsername: giver.username,
      subjectUserId: userId,
      meta: {
        tier: tier.name,
        months: input.months,
        canceledRenewal: chargedElsewhere,
        // The administrator's word that the person agreed to it: the reason a renewal was cancelled for them.
        consentConfirmed: chargedElsewhere ? input.consent : null,
        ...(outcome.conversion ? { changedFrom: outcome.conversion.fromName } : {}),
      },
    });
    return outcome;
  }
}

export const giftService = new GiftService();

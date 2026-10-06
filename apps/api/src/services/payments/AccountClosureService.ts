import { GIFT_PROVIDER_ID } from '@keres/shared/metadata/Payments';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { paymentSubscriptions } from '../../db/schema';
import { emitUserEvent } from '../../modules/webSocket/webSocket.route';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { auditService } from '../AuditService';
import { noteLedger, tierNameOf } from './paymentLedger';
import { getPaymentConnector } from './PaymentConnectorRegistry';
import { ConnectorError } from './connector/signedClient';
import { isStoreMethod, subscriptionService } from './SubscriptionService';

export class AccountClosureService {
  /**
   * An account is being closed: what would charge it again is stopped first, at the provider, so nobody keeps paying
   * for an account that is gone. What is done depends on where the subscription lives:
   *   - at a provider the connector can reach: the renewal is cancelled there, and if that fails the account is
   *     NOT closed (the error says so) - charging somebody who has no account is worse than a retry;
   *   - in a store (Google Play): the same, when the connector can reach the store's API; when it cannot, only a
   *     note is kept and the person has to cancel it in the store;
   *   - a plan given by an administrator, or no live subscription: nothing to stop.
   * What was already paid stays recorded and runs out its period, like any other cancellation.
   */
  async stopForClosedAccount(userId: string, now = new Date()): Promise<void> {
    const row = await subscriptionService.findByUser(userId);
    if (!row || row.providerId === GIFT_PROVIDER_ID) return;
    if (row.status !== 'active' && row.status !== 'due') return;

    const plugin = getPaymentConnector();
    let detail: string;
    if (row.cancelAtPeriodEnd) {
      detail = 'The account was closed; the renewal had already been stopped.';
    } else if (!row.providerReference) {
      detail = 'The account was closed.';
    } else if (plugin && row.providerId === plugin.id && !plugin.cancelSubscription) {
      detail =
        'The account was closed; the connector cannot stop renewals, so stop it at the provider.';
    } else if (!plugin || row.providerId !== plugin.id) {
      throw new AppError(
        502,
        'This account has a subscription and the payment connector is not available to stop it. The account was not closed; try again when it is.',
      );
    } else {
      try {
        await plugin.cancelSubscription?.(row.providerReference);
        detail = 'The account was closed: the renewal was stopped at the provider.';
      } catch (error) {
        // A store subscription the connector cannot reach the store for (it says 400) is the store's to stop:
        // the account closes with a note, and the person cancels it there.
        if (
          error instanceof ConnectorError &&
          error.status === 400 &&
          isStoreMethod(await subscriptionService.lastMethod(row, plugin))
        ) {
          detail =
            'The account was closed; the subscription was bought in the store and has to be cancelled there by the person.';
        } else {
          logger.error(
            'Payment plugin could not stop a subscription of an account being closed',
            error,
          );
          throw new AppError(
            502,
            'Could not stop the subscription at the payment provider. The account was not closed; try again.',
          );
        }
      }
    }

    await db
      .update(paymentSubscriptions)
      .set({
        cancelAtPeriodEnd: true,
        // A period already unpaid has nothing left to run out.
        status: row.status === 'due' ? 'canceled' : row.status,
        updatedAt: now,
      })
      .where(eq(paymentSubscriptions.userId, userId));
    await noteLedger(db, {
      providerId: row.providerId,
      kind: 'subscription_canceled',
      userId,
      tierName: await tierNameOf(row.tierId),
      providerReference: row.providerReference,
      detail,
    });
    auditService.record({
      category: 'payment',
      action: 'payment.subscription_canceled',
      subjectUserId: userId,
      meta: { by: 'account-closed' },
    });
    emitUserEvent(userId, { type: 'payments.changed' });
  }
}

export const accountClosureService = new AccountClosureService();

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServerSelect } from '../db/schema';
import { isOfflineError } from '../services/apiClient';
import { cancelSubscription } from '../services/PaymentService';
import { AppAlert } from '../utils/AppAlert';

/**
 * Stopping a subscription renewing, after the user confirms: what is paid stays in force until its date, and
 * then it ends. `onDone` runs once the server has taken it, so the screen can read the plan again.
 *
 * For a method the provider does not charge by itself (PIX, boleto) there is nothing to stop: what the person
 * says is that they will not pay again, so no new payment is offered and the plan ends on its date. The words
 * say that, instead of "stop renewing".
 */
export function usePlanCancellation(server: ServerSelect | undefined, onDone: () => void) {
  const { t } = useTranslation();

  return useCallback(
    (paidUntil: string, autoRenews = true) => {
      if (!server) return;
      AppAlert.alert(
        t(autoRenews ? 'payment_cancel_title' : 'payment_cancel_no_renewal_title'),
        t(autoRenews ? 'payment_cancel_message' : 'payment_cancel_no_renewal_message', {
          date: new Date(paidUntil).toLocaleDateString(),
        }),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t(autoRenews ? 'payment_cancel_confirm' : 'payment_cancel_no_renewal_confirm'),
            style: 'destructive',
            onPress: async () => {
              try {
                await cancelSubscription(server);
                onDone();
              } catch (error) {
                AppAlert.alert(
                  t('error'),
                  isOfflineError(error)
                    ? t('payment_error_offline')
                    : t('payment_error_cancel_failed'),
                );
              }
            },
          },
        ],
        { cancelable: true },
      );
    },
    [server, onDone, t],
  );
}

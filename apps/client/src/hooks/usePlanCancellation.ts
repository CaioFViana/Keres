import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServerSelect } from '../db/schema';
import { isOfflineError } from '../services/apiClient';
import { cancelSubscription } from '../services/PaymentService';
import { AppAlert } from '../utils/AppAlert';

/**
 * Stopping a subscription renewing, after the user confirms: what is paid stays in force until its date, and
 * then it ends. `onDone` runs once the server has taken it, so the screen can read the plan again.
 */
export function usePlanCancellation(server: ServerSelect | undefined, onDone: () => void) {
  const { t } = useTranslation();

  return useCallback(
    (paidUntil: string) => {
      if (!server) return;
      AppAlert.alert(
        t('payment_cancel_title'),
        t('payment_cancel_message', { date: new Date(paidUntil).toLocaleDateString() }),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('payment_cancel_confirm'),
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

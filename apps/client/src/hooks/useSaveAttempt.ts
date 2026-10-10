import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '@/src/state/notificationStore';

/**
 * The save of a screen that does not throw into the screen: a failure is logged under the screen's name
 * and shown as an error notice with `failureKey`.
 */
export function useSaveAttempt(screenName: string, failureKey: string) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();

  return useCallback(
    async (work: () => Promise<unknown>, logLabel: string) => {
      try {
        await work();
      } catch (error) {
        console.log(`${screenName}: failed to ${logLabel}.`, error);
        showNotification(t(failureKey), 'error');
      }
    },
    [failureKey, screenName, showNotification, t],
  );
}

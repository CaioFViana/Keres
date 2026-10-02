import type { Subscription } from '@keres/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ServerSelect } from '../db/schema';
import { useNotificationStore } from '../state/notificationStore';
import i18n from '../utils/i18n';
import { evaluatePaymentNotice } from '../utils/paymentPlans';

const warnedKey = (serverId: string, paidUntil: string, kind: string) =>
  `keres:payment-warned:${serverId}:${paidUntil}:${kind}`;

/**
 * Reminds the user once - per server, per paid period, per kind of reminder - that a payment is coming up or
 * overdue, if they allowed reminders. Remembered on the device, so it does not come back at every start: a
 * reminder that repeats is the intrusion the setting exists to prevent. Returns whether one was shown.
 */
export async function warnAboutPayment(
  server: Pick<ServerSelect, 'id' | 'name'>,
  subscription: Subscription | null,
  allowed: boolean,
  now: Date = new Date(),
): Promise<boolean> {
  if (!allowed) return false;
  const notice = evaluatePaymentNotice(subscription, now);
  if (notice.kind === 'none' || !subscription) return false;

  const key = warnedKey(server.id, subscription.paidUntil, notice.kind);
  try {
    if (await AsyncStorage.getItem(key)) return false;
    await AsyncStorage.setItem(key, '1');
  } catch {
    // Without storage the reminder cannot be kept to once: better silent than repeated.
    return false;
  }

  const date = new Date(subscription.paidUntil).toLocaleDateString(i18n.language);
  const message =
    notice.kind === 'due'
      ? i18n.t('payment_warning_due', { server: server.name, plan: subscription.tierName, date })
      : i18n.t(notice.daysLeft === 1 ? 'payment_warning_soon_one' : 'payment_warning_soon_other', {
          server: server.name,
          plan: subscription.tierName,
          date,
          count: notice.daysLeft,
        });
  useNotificationStore.getState().showNotification(message, 'warning');
  return true;
}

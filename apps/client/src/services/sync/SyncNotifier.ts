import { useNotificationStore } from '../../state/notificationStore';
import i18n from '../../utils/i18n';

/**
 * Presentation boundary for synchronization. The engine reports what happened; this adapter decides
 * how that result reaches the user and keeps stores and translations out of the protocol coordinator.
 */
export interface SyncNotifier {
  remoteUpdatesReceived(count: number, entities: string[]): void;
  remoteUpdatesFailed(entities: string[]): void;
  conflictsDetected(count: number): void;
  pushFailed(): void;
  syncFailed(): void;
}

export const createAppSyncNotifier = (): SyncNotifier => {
  const notify = (message: string, type: 'info' | 'warning' | 'error') =>
    useNotificationStore.getState().showNotification(message, type);

  return {
    remoteUpdatesReceived: (count, entities) =>
      notify(i18n.t('sync_updates_received', { count, entities: entities.join(', ') }), 'info'),
    remoteUpdatesFailed: (entities) =>
      notify(i18n.t('sync_failed_to_apply_updates', { entities: entities.join(', ') }), 'error'),
    conflictsDetected: (count) => notify(i18n.t('sync_conflicts_detected', { count }), 'warning'),
    pushFailed: () => notify(i18n.t('sync_push_failed'), 'error'),
    syncFailed: () => notify(i18n.t('sync_failed'), 'error'),
  };
};

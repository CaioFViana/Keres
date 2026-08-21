import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AppAlert } from '../utils/AppAlert';

export interface ConfirmDeleteOptions {
  /** Translation key for the confirmation dialog title, e.g. `'delete_tag_title'`. */
  titleKey: string;
  /** Translation key for the confirmation body, e.g. `'delete_tag_message'`. */
  messageKey: string;
  /** Runs after the user confirms. Throwing here surfaces the failure alert. */
  onConfirm: () => Promise<void>;
  /** Shown after a successful delete. Omit to stay silent. */
  successKey?: string;
  /** Shown when `onConfirm` throws. */
  failureKey: string;
  /** Called around the delete so screens can drive their own spinner. */
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * The destructive-delete confirmation flow shared by the entity screens.
 *
 * Fifteen screens each spelled out the same `Alert.alert` with cancel/destructive
 * buttons, the same try/catch around the service call, and the same success and failure
 * alerts - differing only in which translation keys they passed.
 */
export function useConfirmDelete() {
  const { t } = useTranslation();

  return useCallback(
    ({
      titleKey,
      messageKey,
      onConfirm,
      successKey,
      failureKey,
      onLoadingChange,
    }: ConfirmDeleteOptions) => {
      AppAlert.alert(
        t(titleKey),
        t(messageKey),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                onLoadingChange?.(true);
                await onConfirm();
                if (successKey) {
                  AppAlert.alert(t('success'), t(successKey));
                }
              } catch (err) {
                console.error(`Delete failed (${titleKey}):`, err);
                AppAlert.alert(t('error'), t(failureKey));
              } finally {
                onLoadingChange?.(false);
              }
            },
          },
        ],
        { cancelable: true },
      );
    },
    [t],
  );
}

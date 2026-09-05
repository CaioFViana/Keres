import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppAlert } from '../utils/AppAlert';

export interface ConfirmDeleteOptions {
  /** Translation key for the confirmation dialog title, e.g. `'delete_tag_title'`. */
  titleKey: string;
  /** A resolved title for terminology-aware screens. Takes precedence over `titleKey`. */
  title?: string;
  /** Translation key for the confirmation body, e.g. `'delete_tag_message'`. */
  messageKey: string;
  /** A resolved message for terminology-aware screens. Takes precedence over `messageKey`. */
  message?: string;
  /** Runs after the user confirms. Throwing here surfaces the failure alert. */
  onConfirm: () => Promise<void>;
  /** Shown after a successful delete. Omit to stay silent. */
  successKey?: string;
  successMessage?: string;
  /** Shown when `onConfirm` throws. */
  failureKey: string;
  failureMessage?: string;
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
  const deleting = useRef(false);

  return useCallback(
    ({
      titleKey,
      title,
      messageKey,
      message,
      onConfirm,
      successKey,
      successMessage,
      failureKey,
      failureMessage,
      onLoadingChange,
    }: ConfirmDeleteOptions) => {
      AppAlert.alert(
        title ?? t(titleKey),
        message ?? t(messageKey),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: async () => {
              if (deleting.current) return;
              deleting.current = true;
              try {
                onLoadingChange?.(true);
                await onConfirm();
                if (successMessage ?? successKey) {
                  AppAlert.alert(t('success'), successMessage ?? t(successKey!));
                }
              } catch (err) {
                console.error(`Delete failed (${titleKey}):`, err);
                AppAlert.alert(t('error'), failureMessage ?? t(failureKey));
              } finally {
                deleting.current = false;
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

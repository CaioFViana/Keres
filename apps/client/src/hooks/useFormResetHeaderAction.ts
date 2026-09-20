import type { HeaderAction } from '@/src/components/common/navigation/HeaderActions/HeaderActions';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppAlert } from '../utils/AppAlert';

type UseFormResetHeaderActionOptions = {
  isEditing: boolean;
  isDirty: boolean;
  resetForm: () => void;
};

/**
 * The header-right reset action shared by every durable entity form: a confirm dialog that
 * clears back to blanks (create) or re-hydrates saved values (edit), dropping the stored draft.
 */
export function useFormResetHeaderAction({
  isEditing,
  isDirty,
  resetForm,
}: UseFormResetHeaderActionOptions): HeaderAction[] {
  const { t } = useTranslation();
  return useMemo(
    () => [
      {
        id: 'reset-form',
        icon: 'arrow-undo-outline',
        label: t('reset'),
        disabled: !isDirty,
        onPress: () => {
          AppAlert.alert(
            t('form_reset_title'),
            t(isEditing ? 'form_reset_edit_message' : 'form_reset_create_message'),
            [
              { text: t('cancel'), style: 'cancel' },
              { text: t('reset'), style: 'destructive', onPress: () => void resetForm() },
            ],
          );
        },
      },
    ],
    [t, isEditing, isDirty, resetForm],
  );
}

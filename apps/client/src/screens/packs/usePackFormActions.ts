import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { PackService } from '../../services/storymanagement/PackService';
import { useNotificationStore } from '../../state/notificationStore';
import { AppAlert } from '../../utils/AppAlert';
import type { PackFormState } from './usePackFormState';

type UsePackFormActionsOptions = {
  state: PackFormState;
  packServiceRef: RefObject<PackService | null>;
  navigation: { goBack: () => void };
};

/** Owns validation, persistence, feedback and navigation for the Pack form. */
export function usePackFormActions({
  state,
  packServiceRef,
  navigation,
}: UsePackFormActionsOptions) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((store) => store.showNotification);
  const { pending: saving, run: runSave } = useAsyncOperation();

  const handleSave = () =>
    runSave(async () => {
      if (!state.sourceStoryId) {
        AppAlert.alert(t('error'), t('packs_source_required'));
        return;
      }
      if (!state.name.trim()) {
        AppAlert.alert(t('error'), t('packs_name_required'));
        return;
      }
      if (state.nothingSelected) {
        AppAlert.alert(t('error'), t('packs_selection_required'));
        return;
      }
      if (!packServiceRef.current) {
        showNotification(t('packs_save_failed'), 'error');
        return;
      }

      try {
        const service = packServiceRef.current;
        if (state.initialPackId) {
          await service.reextractPack(state.initialPackId, state.selection);
          await service.updatePackDetails(state.initialPackId, {
            name: state.name.trim(),
            description: state.description.trim() || null,
            language: state.language.trim() || null,
            authorName: state.authorName.trim() || null,
          });
        } else {
          await service.createPack({
            sourceStoryId: state.sourceStoryId,
            name: state.name,
            description: state.description.trim() || null,
            language: state.language.trim() || null,
            authorName: state.authorName.trim() || null,
            selection: state.selection,
          });
        }
        navigation.goBack();
      } catch (error) {
        console.error('PackFormScreen: failed to save pack.', error);
        showNotification(t('packs_save_failed'), 'error');
      }
    });

  return { handleSave, saving };
}

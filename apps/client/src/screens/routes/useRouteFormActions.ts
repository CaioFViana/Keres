import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import type { createRouteService } from '../../services/storymanagement/RouteService';
import { AppAlert } from '../../utils/AppAlert';
import type { RouteFormState } from './useRouteFormState';

type RouteService = ReturnType<typeof createRouteService>;
type RouteNavigation = NativeStackNavigationProp<PlotsStackParamList, 'RouteForm'>;

type UseRouteFormActionsOptions = {
  state: RouteFormState;
  routeServiceRef: RefObject<RouteService | null>;
  navigation: RouteNavigation;
  storyId?: string;
  userId?: string | null;
};

/** Owns validation, persistence, feedback and navigation for the Route form. */
export function useRouteFormActions({
  state,
  routeServiceRef,
  navigation,
  storyId,
  userId,
}: UseRouteFormActionsOptions) {
  const { t } = useTranslation();
  const confirmDelete = useConfirmDelete();
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const handleSave = () =>
    runSave(async () => {
      if (!storyId || !userId || !state.name.trim()) {
        AppAlert.alert(
          t('error'),
          !state.name.trim() ? t('route_name_required') : t('user_not_identified'),
        );
        return;
      }
      if (!routeServiceRef.current) {
        AppAlert.alert(t('error'), t('failed_to_save_route'));
        return;
      }

      try {
        const saved = await routeServiceRef.current.save(userId, {
          id: state.routeId,
          storyId,
          name: state.name,
          details: state.details.trim() || null,
        });
        if (state.routeId) navigation.goBack();
        else navigation.replace('RouteDetail', { routeId: saved.id });
      } catch {
        AppAlert.alert(t('error'), t('failed_to_save_route'));
      }
    });

  const handleDelete = () => {
    if (!state.routeId || !userId) return;
    if (!routeServiceRef.current) return;

    const routeId = state.routeId;
    confirmDelete({
      titleKey: 'delete_route_title',
      messageKey: 'delete_route_message',
      successKey: 'route_deleted_successfully',
      failureKey: 'failed_to_delete_route',
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await routeServiceRef.current!.delete(userId, routeId);
        navigation.navigate('Routes');
      },
    });
  };

  return { deleting, handleDelete, handleSave, saving };
}

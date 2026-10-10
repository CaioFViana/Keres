import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useEntityFormActions } from '../../hooks/useEntityFormActions';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import type { createRouteService } from '../../services/storymanagement/RouteService';
import type { RouteFormState } from './useRouteFormState';

type RouteService = ReturnType<typeof createRouteService>;
type RouteNavigation = NativeStackNavigationProp<PlotsStackParamList, 'RouteForm'>;
type RouteData = { name: string; details: string | null };

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

  return useEntityFormActions<RouteData, { id: string }>({
    storyId,
    userId,
    currentEntityId: state.routeId,
    isServiceReady: () => !!routeServiceRef.current,
    clearFormDraft: state.clearFormDraft,
    retainPersistedId: () => {},
    validate: () => (state.name.trim() ? null : t('route_name_required')),
    buildData: () => ({ name: state.name, details: state.details.trim() || null }),
    create: (user, story, data) =>
      routeServiceRef.current!.save(user, { id: undefined, storyId: story, ...data }),
    update: (user, routeId, data) =>
      routeServiceRef.current!.save(user, { id: routeId, storyId: storyId!, ...data }),
    remove: (user, routeId) => routeServiceRef.current!.delete(user, routeId),
    messages: { failedToSave: t('failed_to_save_route') },
    confirmDelete: {
      titleKey: 'delete_route_title',
      messageKey: 'delete_route_message',
      successKey: 'route_deleted_successfully',
      failureKey: 'failed_to_delete_route',
    },
    afterSave: (routeId, created) => {
      if (created) navigation.replace('RouteDetail', { routeId });
      else navigation.goBack();
    },
    afterDelete: () => navigation.navigate('Routes'),
    logName: 'route',
  });
}

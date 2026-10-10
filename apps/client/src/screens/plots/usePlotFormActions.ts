import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useEntityFormActions } from '../../hooks/useEntityFormActions';
import type {
  createPlotSceneService,
  SavePlotScene,
} from '../../services/storymanagement/PlotSceneService';
import type { createPlotService } from '../../services/storymanagement/PlotService';
import { AppAlert } from '../../utils/AppAlert';
import type { PlotsScreenNavigationProp } from './PlotListScreen';
import type { PlotFormState } from './usePlotFormState';

type PlotService = ReturnType<typeof createPlotService>;
type PlotSceneService = ReturnType<typeof createPlotSceneService>;
type PlotData = { name: string; details: string | null };

type UsePlotFormActionsOptions = {
  state: PlotFormState;
  plotServiceRef: RefObject<PlotService | null>;
  plotSceneServiceRef: RefObject<PlotSceneService | null>;
  navigation: PlotsScreenNavigationProp;
  storyId?: string;
  userId?: string | null;
  reloadPlotData(): Promise<void>;
};

/** Owns validation, persistence, scene-relation helpers, feedback and navigation for the Plot form. */
export function usePlotFormActions({
  state,
  plotServiceRef,
  plotSceneServiceRef,
  navigation,
  storyId,
  userId,
  reloadPlotData,
}: UsePlotFormActionsOptions) {
  const { t } = useTranslation();

  const { deleting, handleDelete, handleSave, saving } = useEntityFormActions<
    PlotData,
    { id: string }
  >({
    storyId,
    userId,
    currentEntityId: state.plotId,
    isServiceReady: () => !!plotServiceRef.current,
    clearFormDraft: state.clearFormDraft,
    retainPersistedId: () => {},
    validate: () => (state.name.trim() ? null : t('plot_name_required')),
    buildData: () => ({ name: state.name, details: state.details.trim() || null }),
    create: (user, story, data) =>
      plotServiceRef.current!.save(user, { id: undefined, storyId: story, ...data }),
    update: (user, plotId, data) =>
      plotServiceRef.current!.save(user, { id: plotId, storyId: storyId!, ...data }),
    remove: (user, plotId) => plotServiceRef.current!.delete(user, plotId),
    messages: { failedToSave: t('failed_to_save_plot') },
    confirmDelete: {
      titleKey: 'delete_plot_title',
      messageKey: 'delete_plot_message',
      successKey: 'plot_deleted_successfully',
      failureKey: 'failed_to_delete_plot',
    },
    // A new plot has no relations yet. Keep the author in its form so scenes can be added right
    // away, rather than sending them to the read-only detail screen.
    afterSave: (plotId, created) => {
      if (created) navigation.replace('PlotForm', { plotId });
      else navigation.goBack();
    },
    afterDelete: () => navigation.navigate('Plots'),
    logName: 'plot',
  });

  const handleSavePlotScene = async (relation: SavePlotScene) => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!plotSceneServiceRef.current) return;
    try {
      await plotSceneServiceRef.current.save(userId, relation);
      await reloadPlotData();
    } catch (error) {
      console.error('Failed to save plot-scene relation:', error);
      AppAlert.alert(t('error'), t('failed_to_save_plot_scene_relation'));
    }
  };

  const handleDeletePlotScene = async (relationId: string) => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!plotSceneServiceRef.current) return;
    try {
      await plotSceneServiceRef.current.delete(userId, relationId);
      await reloadPlotData();
    } catch (error) {
      console.error('Failed to delete plot-scene relation:', error);
      AppAlert.alert(t('error'), t('failed_to_delete_plot_scene'));
    }
  };

  return {
    deleting,
    handleDelete,
    handleSave,
    handleSavePlotScene,
    handleDeletePlotScene,
    saving,
  };
}

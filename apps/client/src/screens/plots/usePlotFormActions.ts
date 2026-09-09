import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { RefObject } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { createPlotService } from '../../services/storymanagement/PlotService';
import {
  createPlotSceneService,
  type SavePlotScene,
} from '../../services/storymanagement/PlotSceneService';
import { AppAlert } from '../../utils/AppAlert';
import type { PlotsScreenNavigationProp } from './PlotListScreen';
import type { PlotFormState } from './usePlotFormState';

type PlotService = ReturnType<typeof createPlotService>;
type PlotSceneService = ReturnType<typeof createPlotSceneService>;

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
  const confirmDelete = useConfirmDelete();
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const handleSave = () =>
    runSave(async () => {
      if (!storyId || !userId) {
        AppAlert.alert(t('error'), t('user_not_identified'));
        return;
      }
      if (!state.name.trim()) {
        AppAlert.alert(t('error'), t('plot_name_required'));
        return;
      }
      if (!plotServiceRef.current) {
        AppAlert.alert(t('error'), t('failed_to_save_plot'));
        return;
      }

      try {
        const saved = await plotServiceRef.current.save(userId, {
          id: state.plotId,
          storyId,
          name: state.name,
          details: state.details.trim() || null,
        });
        if (state.isEditing) navigation.goBack();
        // A new plot has no relations yet. Keep the author in its form so scenes can be added right
        // away, rather than sending them to the read-only detail screen.
        else navigation.replace('PlotForm', { plotId: saved.id });
      } catch (error) {
        console.error('Failed to save plot:', error);
        AppAlert.alert(t('error'), t('failed_to_save_plot'));
      }
    });

  const handleDelete = () => {
    if (!userId || !state.plotId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!plotServiceRef.current) return;

    const plotId = state.plotId;
    confirmDelete({
      titleKey: 'delete_plot_title',
      messageKey: 'delete_plot_message',
      successKey: 'plot_deleted_successfully',
      failureKey: 'failed_to_delete_plot',
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await plotServiceRef.current!.delete(userId, plotId);
        navigation.navigate('Plots');
      },
    });
  };

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

import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import PlotSceneManager from '@/src/components/features/plots/PlotSceneManager/PlotSceneManager';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStoryPlots } from '../../hooks/useStoryPlots';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { createPlotService } from '../../services/storymanagement/PlotService';
import { createPlotSceneService } from '../../services/storymanagement/PlotSceneService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import {
  commonFormStyleDefs,
  getCommonContainerStyles,
  getCommonInputStyles,
} from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { setDocumentTitle } from '../../utils/documentTitle';
import type { PlotsScreenNavigationProp } from './PlotListScreen';

type PlotFormScreenRouteProp = RouteProp<PlotsStackParamList, 'PlotForm'>;

/** The Plot form is the one authoring surface for its own fields and scene membership. */
const PlotFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<PlotsScreenNavigationProp>();
  const route = useRoute<PlotFormScreenRouteProp>();
  const plotId = route.params?.plotId;
  const isEditing = !!plotId;
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const plotService = useCallback(() => createPlotService(drizzleDb), [drizzleDb]);
  const plotSceneService = useCallback(() => createPlotSceneService(drizzleDb), [drizzleDb]);
  const {
    scenes,
    relationsOf,
    chapterNameOf,
    reload: reloadPlotData,
  } = useStoryPlots(selectedStory?.id, selectedStory?.type);

  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(isEditing);

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        ...commonFormStyleDefs(colors, scrollBottomPadding),
        description: {
          color: colors.textSecondary,
          marginBottom: 20,
        },
        saveButton: {
          marginTop: 20,
          marginBottom: 0,
        },
        deleteButton: {
          backgroundColor: colors.error,
          marginTop: 10,
          marginBottom: 15,
        },
      }),
    [colors, scrollBottomPadding],
  );

  useFocusEffect(
    useCallback(() => {
      const title = isEditing ? t('edit_plot') : t('create_plot');
      setDocumentTitle(title);
      navigation.getParent()?.setOptions({ title, headerRight: () => <View /> });
    }, [isEditing, navigation, t]),
  );

  useEffect(() => {
    if (!isEditing) return;
    const loadPlot = async () => {
      try {
        const plot = await plotService().getById(plotId!);
        if (plot) {
          setName(plot.name);
          setDetails(plot.details ?? '');
        }
      } catch (error) {
        console.error('Failed to load plot:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPlot();
  }, [isEditing, plotId, plotService]);

  const handleSave = async () => {
    if (!selectedStory?.id || !userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!name.trim()) {
      AppAlert.alert(t('error'), t('plot_name_required'));
      return;
    }
    setLoading(true);
    try {
      const saved = await plotService().save(userId, {
        id: plotId,
        storyId: selectedStory.id,
        name,
        details: details.trim() || null,
      });
      if (isEditing) navigation.goBack();
      // A new plot has no relations yet. Keep the author in its form so scenes can be added right
      // away, rather than sending them to the read-only detail screen.
      else navigation.replace('PlotForm', { plotId: saved.id });
    } catch (error) {
      console.error('Failed to save plot:', error);
      AppAlert.alert(t('error'), t('failed_to_save_plot'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!userId || !plotId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    confirmDelete({
      titleKey: 'delete_plot_title',
      messageKey: 'delete_plot_message',
      successKey: 'plot_deleted_successfully',
      failureKey: 'failed_to_delete_plot',
      onLoadingChange: setLoading,
      onConfirm: async () => {
        await plotService().delete(userId, plotId);
        navigation.navigate('Plots');
      },
    });
  };

  const handleSavePlotScene = async (
    relation: Parameters<ReturnType<typeof createPlotSceneService>['save']>[1],
  ) => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    try {
      await plotSceneService().save(userId, relation);
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
    try {
      await plotSceneService().delete(userId, relationId);
      await reloadPlotData();
    } catch (error) {
      console.error('Failed to delete plot-scene relation:', error);
      AppAlert.alert(t('error'), t('failed_to_delete_plot_scene'));
    }
  };

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.text }}>{t('loading')}...</Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.scrollViewContent}
    >
      <Text style={styles.title}>{isEditing ? t('edit_plot') : t('create_plot')}</Text>
      <Text style={styles.description}>{t('plot_form_description')}</Text>

      <Text style={styles.label}>{t('plot_name')}</Text>
      <TextInput
        placeholder={t('plot_name_placeholder')}
        value={name}
        onChangeText={setName}
        style={commonInputStyles.input}
      />

      <Text style={styles.label}>{t('plot_details')}</Text>
      <TextInput
        placeholder={t('plot_details_placeholder')}
        value={details}
        onChangeText={setDetails}
        style={commonInputStyles.multiline}
        multiline
      />

      {isEditing && selectedStory?.id ? (
        <PlotSceneManager
          relations={relationsOf(plotId!)}
          scenes={scenes}
          chapterNameOf={chapterNameOf}
          onSave={handleSavePlotScene}
          onDelete={handleDeletePlotScene}
          editable
          currentStoryId={selectedStory.id}
          currentPlotId={plotId!}
        />
      ) : null}

      {isEditing ? (
        <FormActions stackOnCompact>
          <Button onPress={handleSave}>{t('save_changes')}</Button>
          <Button onPress={handleDelete} style={{ backgroundColor: colors.error }}>
            {t('delete_plot_title')}
          </Button>
        </FormActions>
      ) : (
        <Button onPress={handleSave} style={styles.saveButton}>
          {t('create_plot')}
        </Button>
      )}
    </KeyboardAwareScreen>
  );
};

export default PlotFormScreen;

import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import PlotSceneManager from '@/src/components/features/plots/PlotSceneManager/PlotSceneManager';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import type { PlotsScreenNavigationProp } from './PlotListScreen';
import { usePlotFormActions } from './usePlotFormActions';
import { usePlotFormResources } from './usePlotFormResources';
import { usePlotFormState } from './usePlotFormState';

type PlotFormScreenRouteProp = RouteProp<PlotsStackParamList, 'PlotForm'>;

/** The Plot form is the one authoring surface for its own fields and scene membership. */
const PlotFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<PlotsScreenNavigationProp>();
  const route = useRoute<PlotFormScreenRouteProp>();
  const plotId = route.params?.plotId;
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  const {
    plotServiceRef,
    plotSceneServiceRef,
    scenes,
    relationsOf,
    chapterNameOf,
    reloadPlotData,
  } = usePlotFormResources(selectedStory?.id, selectedStory?.type);

  const plotFormState = usePlotFormState({
    plotId,
    plotServiceRef,
  });
  const { name, setName, details, setDetails, loading, isEditing } = plotFormState;

  const { deleting, handleDelete, handleSave, handleSavePlotScene, handleDeletePlotScene, saving } =
    usePlotFormActions({
      state: plotFormState,
      plotServiceRef,
      plotSceneServiceRef,
      navigation,
      storyId: selectedStory?.id,
      userId,
      reloadPlotData,
    });

  const commonInputStyles = getCommonInputStyles(colors);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        saveButton: {
          marginTop: 20,
          marginBottom: 0,
        },
      }),
    [],
  );

  useScreenHeader({
    target: 'parent',
    title: isEditing ? t('edit_plot') : t('create_plot'),
  });

  if (loading) {
    return <ScreenLoading />;
  }

  return (
    <EntityFormContainer
      title={isEditing ? t('edit_plot') : t('create_plot')}
      description={t('plot_form_description')}
    >
      <FormField label={t('plot_name')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('plot_name_placeholder')}
            value={name}
            onChangeText={setName}
            style={commonInputStyles.input}
          />
        )}
      </FormField>

      <FormField label={t('plot_details')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('plot_details_placeholder')}
            value={details}
            onChangeText={setDetails}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

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
          <Button onPress={handleSave} disabled={saving || deleting}>
            {t('save_changes')}
          </Button>
          <Button
            onPress={handleDelete}
            style={{ backgroundColor: colors.error }}
            disabled={saving || deleting}
          >
            {t('delete_plot_title')}
          </Button>
        </FormActions>
      ) : (
        <Button onPress={handleSave} style={styles.saveButton} disabled={saving || deleting}>
          {t('create_plot')}
        </Button>
      )}
    </EntityFormContainer>
  );
};

export default PlotFormScreen;

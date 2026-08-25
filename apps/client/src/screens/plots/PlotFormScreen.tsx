import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
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
import type { PlotsStackParamList } from '../../navigation/MainSystemStack';
import { createPlotService } from '../../services/storymanagement/PlotService';
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

/**
 * Cria e edita apenas nome e detalhes. As cenas da trama são gerenciadas no formulário da
 * Cena - dois editores para a mesma relação sempre acabam discordando sobre o que foi salvo.
 */
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
      else navigation.replace('PlotDetail', { plotId: saved.id });
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
        style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
        multiline
      />

      <Button onPress={handleSave} style={styles.saveButton}>
        {isEditing ? t('save_changes') : t('create_plot')}
      </Button>

      {isEditing && (
        <Button onPress={handleDelete} style={styles.deleteButton}>
          {t('delete_plot_title')}
        </Button>
      )}
    </KeyboardAwareScreen>
  );
};

export default PlotFormScreen;

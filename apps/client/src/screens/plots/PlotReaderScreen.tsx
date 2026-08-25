import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import Select from '@/src/components/common/inputs/Select/Select';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useNavigateToEntityDetail } from '../../hooks/useNavigateToEntityDetail';
import { useStoryPlots } from '../../hooks/useStoryPlots';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';
import type { PlotsScreenNavigationProp } from './PlotListScreen';

const ALL_SCENES = '__all__';

/**
 * Leitura estrutural da história: número/título discreto da cena e o resumo em parágrafo
 * corrido. Sem cartões e sem controles de edição de propósito - a nota da relação fica no
 * detalhe da trama e na matriz, aqui o objetivo é ler o resumo.
 */
const PlotReaderScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<PlotsScreenNavigationProp>();
  const navigateToDetail = useNavigateToEntityDetail();
  // O título da cena leva ao detalhe dela, em outra pilha; a volta traz o leitor de novo.
  const openScene = useCallback(
    (sceneId: string) =>
      navigateToDetail('Scene', sceneId, {
        onReturn: () => navigation.navigate('PlotsStack', { screen: 'PlotReader' }),
      }),
    [navigateToDetail, navigation],
  );
  const { selectedStory } = useStoryStore();
  const scrollBottomPadding = useFormScrollBottomPadding();

  const { plots, relationsOf, sceneById, scenes, loading } = useStoryPlots(
    selectedStory?.type === 'linear' ? selectedStory?.id : undefined,
  );
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(ALL_SCENES);

  const isAllScenes = !selectedPlotId || selectedPlotId === ALL_SCENES;
  const readerScenes = useMemo(
    () =>
      isAllScenes
        ? scenes
        : relationsOf(selectedPlotId!)
            .map((relation) => sceneById(relation.sceneId))
            .filter((scene): scene is (typeof scenes)[number] => !!scene),
    [isAllScenes, relationsOf, sceneById, scenes, selectedPlotId],
  );
  const scopeLabel = isAllScenes
    ? t('all_scenes')
    : (plots.find((plot) => plot.id === selectedPlotId)?.name ?? t('all_scenes'));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        ...commonScreenStyleDefs(colors),
        header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, gap: 10 },
        scope: { color: colors.textSecondary, fontSize: 13 },
        content: { paddingHorizontal: 20, paddingBottom: scrollBottomPadding },
        entry: { paddingVertical: 18 },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        sceneTitle: {
          color: colors.textSecondary,
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 8,
        },
        summary: { color: colors.text, fontSize: 16, lineHeight: 26 },
        missingSummary: { color: colors.textSecondary, fontSize: 16, fontStyle: 'italic' },
        empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
      }),
    [colors, scrollBottomPadding],
  );

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('plot_reader_title'));
      navigation.getParent()?.setOptions({
        title: t('plot_reader_title'),
        headerRight: undefined,
      });
    }, [navigation, t]),
  );

  if (selectedStory?.type !== 'linear') {
    return <ScreenError message={t('plots_linear_only')} onGoBack={() => navigation.goBack()} />;
  }

  if (loading) {
    return <ScreenLoading message={t('loading_plots')} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Select
          options={[
            { label: t('all_scenes'), value: ALL_SCENES },
            ...plots.map((plot) => ({ label: plot.name, value: plot.id })),
          ]}
          value={selectedPlotId}
          onValueChange={setSelectedPlotId}
          placeholder={t('all_scenes')}
          multiple={false}
        />
        <Text style={styles.scope}>
          {t('plot_reader_scope', { scope: scopeLabel, count: readerScenes.length })}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {readerScenes.length === 0 ? (
          <Text style={styles.empty}>
            {isAllScenes ? t('plot_reader_no_scenes') : t('no_plot_scenes')}
          </Text>
        ) : (
          readerScenes.map((scene, index) => (
            <View key={scene.id}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.entry}>
                <TouchableOpacity onPress={() => openScene(scene.id)}>
                  <Text style={styles.sceneTitle}>{`${index + 1}. ${scene.name}`}</Text>
                </TouchableOpacity>
                <Text style={scene.summary ? styles.summary : styles.missingSummary}>
                  {scene.summary || t('plot_reader_no_summary')}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default PlotReaderScreen;

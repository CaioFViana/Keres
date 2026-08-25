import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStoryPlots } from '../../hooks/useStoryPlots';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';
import { buildPlotCoverage } from '@keres/shared/graphs/plotCoverageLayout';
import { renderPlotCoverageSvg } from '@keres/shared/graphs/plotCoverageSvg';
import { buildChapterColors } from '@keres/shared/graphs/storyGraphLayout';
import { deliverSvgMap } from '../../utils/storyTransfer';
import type { PlotsScreenNavigationProp } from './PlotListScreen';

/**
 * Quanto da história cada trama percorre. **Cobertura**, e não participação: uma cena pode
 * pertencer a várias tramas, então os percentuais não somam 100%.
 */
const PlotProgressScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<PlotsScreenNavigationProp>();
  const notify = useNotificationStore((state) => state.showNotification);
  const { selectedStory } = useStoryStore();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const [saving, setSaving] = useState(false);

  const { plots, relations, scenes, chapters, loading } = useStoryPlots(
    selectedStory?.type === 'linear' ? selectedStory?.id : undefined,
  );

  // Tramas vazias entram na média: elas fazem parte do plano da história tanto quanto as
  // cheias, e escondê-las daria uma média otimista demais.
  const average = plots.length ? relations.length / plots.length : 0;

  const chapterColors = useMemo(() => buildChapterColors(chapters), [chapters]);

  const entries = useMemo(
    () =>
      buildPlotCoverage({
        plots: [...plots].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        ),
        chapters: chapters.map((chapter) => ({
          id: chapter.id,
          name: chapter.name,
          color: chapterColors.get(chapter.id) ?? colors.primary,
        })),
        scenes,
        relations,
      }),
    [chapterColors, chapters, colors.primary, plots, relations, scenes],
  );

  /** Só os capítulos que aparecem em alguma barra - uma legenda com capítulo ausente confunde. */
  const legend = useMemo(() => {
    const used = new Set(entries.flatMap((entry) => entry.segments.map((s) => s.chapterId)));
    return chapters
      .filter((chapter) => used.has(chapter.id))
      .map((chapter) => ({
        id: chapter.id,
        name: chapter.name,
        color: chapterColors.get(chapter.id) ?? colors.primary,
      }));
  }, [chapterColors, chapters, colors.primary, entries]);

  const commonContainerStyles = getCommonContainerStyles(colors);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        scrollContent: { paddingBottom: scrollBottomPadding },
        headerRightButton: { marginRight: 15 },
        summary: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
        hint: { color: colors.textSecondary, fontSize: 13, marginTop: 8, marginBottom: 16 },
        row: {
          backgroundColor: colors.surface,
          borderRadius: 8,
          padding: 12,
          marginBottom: 8,
        },
        rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        name: { fontSize: 16, fontWeight: 'bold', color: colors.text, flex: 1, marginRight: 10 },
        meta: { fontSize: 13, color: colors.textSecondary },
        track: {
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.border,
          overflow: 'hidden',
          marginTop: 10,
        },
        // Os pedaços encostam uns nos outros dentro do trilho; só as pontas da barra são
        // arredondadas, pelo próprio `overflow: hidden` do trilho.
        segments: { flexDirection: 'row', height: '100%' },
        segment: { height: '100%' },
        legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
        legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        legendSwatch: { width: 10, height: 10, borderRadius: 3 },
        legendLabel: { color: colors.textSecondary, fontSize: 12 },
        empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 30 },
      }),
    [colors, scrollBottomPadding],
  );

  const exportCoverage = useCallback(async () => {
    if (!selectedStory || entries.length === 0) return;
    setSaving(true);
    try {
      const svg = renderPlotCoverageSvg(entries, {
        title: selectedStory.title,
        subtitle: t('plot_progress_title'),
        average: t('plot_average_scenes', { count: average.toFixed(1) }),
        background: colors.background,
        surface: colors.surface,
        text: colors.text,
        border: colors.border,
        primary: colors.primary,
      });
      const result = await deliverSvgMap(svg, `${selectedStory.title}-cobertura.svg`);
      notify(
        result.delivered
          ? t('plot_coverage_export_success', { fileName: result.fileName })
          : t('plot_coverage_export_no_share_target', { path: result.uri || result.fileName }),
        result.delivered ? 'success' : 'warning',
      );
    } finally {
      setSaving(false);
    }
  }, [average, colors, entries, notify, selectedStory, t]);

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('plot_progress_title'));
      navigation.getParent()?.setOptions({
        title: t('plot_progress_title'),
        headerRight: () => (
          <TouchableOpacity
            onPress={exportCoverage}
            disabled={saving || entries.length === 0}
            style={styles.headerRightButton}
            accessibilityLabel={t('plot_coverage_export')}
          >
            <Ionicons
              name="image-outline"
              size={24}
              color={entries.length === 0 ? colors.textSecondary : colors.text}
            />
          </TouchableOpacity>
        ),
      });
    }, [
      colors.text,
      colors.textSecondary,
      entries.length,
      exportCoverage,
      navigation,
      saving,
      styles.headerRightButton,
      t,
    ]),
  );

  if (selectedStory?.type !== 'linear') {
    return <ScreenError message={t('plots_linear_only')} onGoBack={() => navigation.goBack()} />;
  }

  if (loading) {
    return <ScreenLoading padded message={t('loading_plots')} />;
  }

  return (
    <ScrollView
      style={commonContainerStyles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.summary}>{t('plot_average_scenes', { count: average.toFixed(1) })}</Text>
      <Text style={styles.summary}>{t('plot_coverage_denominator', { count: scenes.length })}</Text>
      <Text style={styles.hint}>{t('plot_coverage_overlap_hint')}</Text>

      {legend.length > 0 && (
        <View style={styles.legend}>
          {legend.map((chapter) => (
            <View key={chapter.id} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: chapter.color }]} />
              <Text style={styles.legendLabel}>{chapter.name}</Text>
            </View>
          ))}
        </View>
      )}

      {entries.length === 0 ? (
        <Text style={styles.empty}>{t('no_plots')}</Text>
      ) : (
        entries.map((entry) => (
          <TouchableOpacity
            key={entry.id}
            style={styles.row}
            onPress={() => navigation.navigate('PlotDetail', { plotId: entry.id })}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.name} numberOfLines={1}>
                {entry.name}
              </Text>
              <Text style={styles.meta}>
                {t('plot_coverage_value', {
                  covered: entry.covered,
                  total: entry.total,
                  percentage: entry.percentage,
                })}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={styles.segments}>
                {entry.segments.map((segment) => (
                  <View
                    key={segment.chapterId}
                    style={[
                      styles.segment,
                      { width: `${segment.percentage}%`, backgroundColor: segment.color },
                    ]}
                  />
                ))}
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

export default PlotProgressScreen;

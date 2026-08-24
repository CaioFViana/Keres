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
import { renderPlotCoverageSvg } from '../../utils/plotCoverageSvg';
import { deliverSvgMap } from '../../utils/storyTransfer';
import { PlotsScreenNavigationProp } from './PlotListScreen';

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

  const { plots, relations, scenes, coverageOf, loading } = useStoryPlots(
    selectedStory?.type === 'linear' ? selectedStory?.id : undefined,
  );

  // Tramas vazias entram na média: elas fazem parte do plano da história tanto quanto as
  // cheias, e escondê-las daria uma média otimista demais.
  const average = plots.length ? relations.length / plots.length : 0;

  const entries = useMemo(
    () =>
      [...plots]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map((plot) => ({ plot, ...coverageOf(plot.id) })),
    [coverageOf, plots],
  );

  const commonContainerStyles = getCommonContainerStyles(colors);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        scrollContent: { paddingBottom: scrollBottomPadding },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        title: { fontSize: 24, fontWeight: 'bold', color: colors.text, flex: 1 },
        actionButton: { padding: 8 },
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
        fill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
        empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 30 },
      }),
    [colors, scrollBottomPadding],
  );

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('plot_progress_title'));
      navigation.getParent()?.setOptions({
        title: t('plot_progress_title'),
        headerRight: undefined,
      });
    }, [navigation, t]),
  );

  const exportCoverage = useCallback(async () => {
    if (!selectedStory || entries.length === 0) return;
    setSaving(true);
    try {
      const svg = renderPlotCoverageSvg(
        entries.map((entry) => ({
          name: entry.plot.name,
          covered: entry.covered,
          total: entry.total,
          percentage: entry.percentage,
        })),
        {
          title: selectedStory.title,
          subtitle: t('plot_progress_title'),
          average: t('plot_average_scenes', { count: average.toFixed(1) }),
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          border: colors.border,
          primary: colors.primary,
        },
      );
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
      <View style={styles.header}>
        <Text style={styles.title}>{t('plot_progress_title')}</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={exportCoverage}
          disabled={saving || entries.length === 0}
          accessibilityLabel={t('plot_coverage_export')}
        >
          <Ionicons
            name="image-outline"
            size={24}
            color={entries.length === 0 ? colors.textSecondary : colors.primary}
          />
        </TouchableOpacity>
      </View>
      <Text style={styles.summary}>{t('plot_average_scenes', { count: average.toFixed(1) })}</Text>
      <Text style={styles.summary}>{t('plot_coverage_denominator', { count: scenes.length })}</Text>
      <Text style={styles.hint}>{t('plot_coverage_overlap_hint')}</Text>

      {entries.length === 0 ? (
        <Text style={styles.empty}>{t('no_plots')}</Text>
      ) : (
        entries.map((entry) => (
          <TouchableOpacity
            key={entry.plot.id}
            style={styles.row}
            onPress={() => navigation.navigate('PlotDetail', { plotId: entry.plot.id })}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.name} numberOfLines={1}>
                {entry.plot.name}
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
              <View style={[styles.fill, { width: `${entry.percentage}%` }]} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

export default PlotProgressScreen;

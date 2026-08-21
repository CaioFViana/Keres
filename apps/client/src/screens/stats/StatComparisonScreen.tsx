import { Ionicons } from '@expo/vector-icons';
import { type RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '../../components/common/controls/Button/Button';
import EntityPickerInput from '../../components/common/inputs/EntityPickerInput/EntityPickerInput';
import Select from '../../components/common/inputs/Select/Select';
import { StatRadarChart } from '../../components/features/stats/StatRadarChart/StatRadarChart';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useStoryStats } from '../../hooks/useStoryStats';
import { StatsStackParamList } from '../../navigation/StatsStack';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { useDocumentTitle } from '../../utils/documentTitle';
import { deliverSvgMap } from '../../utils/storyTransfer';
import type { StatNotation } from '../../utils/statLadder';
import { buildStatRadarLayout, MIN_PRIMARY_STATS_FOR_CHART } from '../../utils/statRadarLayout';
import { renderStatRadarSvg } from '../../utils/statRadarSvg';
import { resolveStatValue } from '../../utils/statValues';

type StatComparisonNavigationProp = NativeStackNavigationProp<
  StatsStackParamList,
  'StatComparison'
>;

/** Quatro polígonos sobrepostos ainda são legíveis; acima disso o desenho vira sopa. */
const MAX_SERIES = 4;
const CHART_SIZE_COMPACT = 320;
const CHART_SIZE_WIDE = 420;

interface SeriesSlot {
  key: string;
  characterId: string | null;
  modeId: string | null;
}

let slotCounter = 0;
const newSlot = (characterId: string | null = null): SeriesSlot => ({
  key: `slot-${(slotCounter += 1)}`,
  characterId,
  modeId: null,
});

const StatComparisonScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isCompact } = useResponsiveLayout();
  const navigation = useNavigation<StatComparisonNavigationProp>();
  const route = useRoute<RouteProp<StatsStackParamList, 'StatComparison'>>();
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const notation = (selectedStory?.statNotation ?? 'letter') as StatNotation;
  const data = useStoryStats(storyId);
  const showNotification = useNotificationStore((state) => state.showNotification);

  const [slots, setSlots] = useState<SeriesSlot[]>(() => [
    route.params?.characterId
      ? { ...newSlot(route.params.characterId), modeId: route.params.modeId ?? null }
      : newSlot(),
    newSlot(),
  ]);
  const [exporting, setExporting] = useState(false);

  useDocumentTitle(t('stat_compare_title'));
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: t('stat_compare_title') });
    }, [navigation, t]),
  );

  // Uma cor de tema por série: as quatro são distinguíveis em todas as paletas do app.
  const seriesColors = useMemo(
    () => [colors.primary, colors.error, colors.secondary, colors.accent],
    [colors],
  );

  const nameOf = useCallback(
    (characterId: string) =>
      data.characters.find((character) => character.id === characterId)?.name ?? characterId,
    [data.characters],
  );

  const layout = useMemo(() => {
    const active = slots.filter((slot) => slot.characterId);
    const series = active.map((slot, index) => {
      const values = new Map<string, number | null>();
      for (const stat of data.primaryStats) {
        values.set(
          stat.id,
          resolveStatValue(data.valueIndex, slot.characterId!, slot.modeId, stat.id).value,
        );
      }
      const modeName = data.modes.find((mode) => mode.id === slot.modeId)?.name;
      const baseName = nameOf(slot.characterId!);
      return {
        id: slot.key,
        label: modeName ? `${baseName} · ${modeName}` : baseName,
        color: seriesColors[index % seriesColors.length]!,
        values,
      };
    });

    return buildStatRadarLayout({
      stats: data.primaryStats.map((stat) => ({
        id: stat.id,
        name: stat.name,
        ladder: data.ladderOf(stat.id),
      })),
      series,
      notation,
      size: isCompact ? CHART_SIZE_COMPACT : CHART_SIZE_WIDE,
    });
  }, [data, isCompact, nameOf, notation, seriesColors, slots]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: 16 },
        slotRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
        slotPicker: { flex: 2 },
        slotMode: { flex: 1.4 },
        swatch: { width: 12, height: 12, borderRadius: 3 },
        iconButton: { padding: 6 },
        legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
        legendLabel: { color: colors.text },
        hint: { color: colors.textSecondary, marginTop: 8 },
      }),
    [colors],
  );

  const handleExport = useCallback(async () => {
    if (!layout || !selectedStory) return;
    setExporting(true);
    try {
      const svg = renderStatRadarSvg(layout, {
        title: selectedStory.title,
        subtitle: t('stat_compare_title'),
        showLegend: true,
        colors: {
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
        },
      });
      const result = await deliverSvgMap(svg, `${selectedStory.title}-stats.svg`);
      showNotification(
        result.delivered
          ? t('stat_export_success', { fileName: result.fileName })
          : t('stat_export_no_share_target', { path: result.uri || result.fileName }),
        result.delivered ? 'success' : 'warning',
      );
    } catch (error) {
      console.log('StatComparisonScreen: failed to export the chart.', error);
      showNotification(t('stat_export_failed'), 'error');
    } finally {
      setExporting(false);
    }
  }, [colors, layout, selectedStory, showNotification, t]);

  const commonContainerStyles = getCommonContainerStyles(colors);

  const modeOptionsFor = (characterId: string | null) => [
    { label: t('mode_normal'), value: '' },
    ...data.modes
      .filter((mode) => mode.characterId === characterId)
      .map((mode) => ({ label: mode.name, value: mode.id })),
  ];

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.content}>
      {slots.map((slot, index) => (
        <View key={slot.key} style={styles.slotRow}>
          <View
            style={[styles.swatch, { backgroundColor: seriesColors[index % seriesColors.length] }]}
          />
          <View style={styles.slotPicker}>
            <EntityPickerInput
              storyId={storyId ?? ''}
              entityType="Character"
              value={slot.characterId}
              onChange={(value) =>
                setSlots((current) =>
                  current.map((item) =>
                    item.key === slot.key ? { ...item, characterId: value, modeId: null } : item,
                  ),
                )
              }
              placeholder={t('characters_title')}
            />
          </View>
          <View style={styles.slotMode}>
            <Select
              options={modeOptionsFor(slot.characterId)}
              value={slot.modeId ?? ''}
              onValueChange={(value) =>
                setSlots((current) =>
                  current.map((item) =>
                    item.key === slot.key ? { ...item, modeId: value ? value : null } : item,
                  ),
                )
              }
              placeholder={t('mode_normal')}
              disabled={!slot.characterId}
            />
          </View>
          {slots.length > 1 ? (
            <TouchableOpacity
              style={styles.iconButton}
              accessibilityLabel={t('delete')}
              onPress={() => setSlots((current) => current.filter((item) => item.key !== slot.key))}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      ))}

      {slots.length < MAX_SERIES ? (
        <Button onPress={() => setSlots((current) => [...current, newSlot()])}>
          {t('stat_compare_add')}
        </Button>
      ) : (
        <Text style={styles.hint}>{t('stat_compare_limit', { count: MAX_SERIES })}</Text>
      )}

      <View style={{ marginTop: 16 }}>
        <StatRadarChart
          layout={layout}
          emptyMessage={t('stat_needs_more_primaries', { count: MIN_PRIMARY_STATS_FOR_CHART })}
        />
      </View>

      {layout?.series.map((series) => (
        <View key={series.id} style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: series.color }]} />
          <Text style={styles.legendLabel}>{series.label}</Text>
        </View>
      ))}

      {layout && layout.series.length > 0 ? (
        <Button onPress={handleExport} disabled={exporting} style={{ marginTop: 16 }}>
          {exporting ? t('saving') : t('stat_export')}
        </Button>
      ) : null}
    </ScrollView>
  );
};

export default StatComparisonScreen;

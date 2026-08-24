import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { type RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/common/controls/Button/Button';
import MultiSelectPill from '../../components/common/inputs/MultiSelectPill/MultiSelectPill';
import Select from '../../components/common/inputs/Select/Select';
import { StatRadarChart } from '../../components/features/stats/StatRadarChart/StatRadarChart';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useStoryStats } from '../../hooks/useStoryStats';
import type { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import type { StatsStackParamList } from '../../navigation/StatsStack';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { useDocumentTitle } from '../../utils/documentTitle';
import { navigateToEntityDetail } from '../../utils/entityNavigation';
import { deliverSvgMap } from '../../utils/storyTransfer';
import { formatStatValueDetailed, type StatNotation } from '../../utils/statLadder';
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

  const [slots, setSlots] = useState<SeriesSlot[]>(() =>
    route.params?.characterId
      ? [{ ...newSlot(route.params.characterId), modeId: route.params.modeId ?? null }]
      : [],
  );
  const [exporting, setExporting] = useState(false);

  // Aberta a partir do detalhe de um personagem, a volta é para ele - e não para a lista de
  // status, que é onde a pilha deste stack começa. Ver `onBack` em useBackButtonHandler.
  const openedFromCharacterId = route.params?.characterId;
  useBackButtonHandler({
    showWebBackButton: true,
    onBack: openedFromCharacterId
      ? () =>
          navigateToEntityDetail(
            navigation.getParent() as unknown as DrawerNavigationProp<MainSystemDrawerParamList>,
            'Character',
            openedFromCharacterId,
          )
      : undefined,
  });

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
        content: { padding: 16, paddingBottom: 32 },
        // Cada série selecionada só precisa configurar seu modo. A seleção em si fica em um
        // único campo acima, para não parecer que existem cartões vazios para preencher.
        slotCard: {
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          gap: 10,
        },
        slotHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        slotTitle: {
          color: colors.text,
          flex: 1,
          fontSize: 16,
          fontWeight: '600',
        },
        swatch: { width: 12, height: 12, borderRadius: 3 },
        modeLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: -4 },
        sectionTitle: {
          color: colors.text,
          fontSize: 16,
          fontWeight: 'bold',
          marginTop: 20,
          marginBottom: 8,
        },
        valueHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
        valueRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 8,
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        valueStatName: { color: colors.text, flex: 1.6, fontSize: 14 },
        valueCell: { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'right' },
        valueHeaderCell: { flex: 1, fontSize: 12, textAlign: 'right' },
        limitHint: { color: colors.textSecondary, marginTop: -10, marginBottom: 16 },
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

  const characterOptions = useMemo(
    () =>
      data.characters.map((character) => {
        const seriesIndex = slots.findIndex((slot) => slot.characterId === character.id);
        return {
          label: character.name,
          value: character.id,
          color: seriesIndex >= 0 ? seriesColors[seriesIndex % seriesColors.length] : undefined,
        };
      }),
    [data.characters, seriesColors, slots],
  );

  const handleCharacterSelection = useCallback((characterIds: string[]) => {
    setSlots((current) => {
      const slotsByCharacterId = new Map(
        current.filter((slot) => slot.characterId).map((slot) => [slot.characterId!, slot]),
      );
      return characterIds.slice(0, MAX_SERIES).map((characterId) => {
        const existing = slotsByCharacterId.get(characterId);
        return existing ?? newSlot(characterId);
      });
    });
  }, []);

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.content}>
      <MultiSelectPill
        label={t('stat_compare_characters')}
        options={characterOptions}
        selectedValues={slots.flatMap((slot) => (slot.characterId ? [slot.characterId] : []))}
        onSelectionChange={handleCharacterSelection}
        maxSelections={MAX_SERIES}
        placeholder={t('stat_compare_select_characters', { count: MAX_SERIES })}
        searchPlaceholder={t('search_characters')}
        style={{ marginBottom: 16 }}
      />
      {slots.length >= MAX_SERIES ? (
        <Text style={styles.limitHint}>{t('stat_compare_limit', { count: MAX_SERIES })}</Text>
      ) : null}

      {slots.map((slot, index) => {
        const modeOptions = modeOptionsFor(slot.characterId);
        return (
          <View key={slot.key} style={styles.slotCard}>
            <View style={styles.slotHeader}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: seriesColors[index % seriesColors.length] },
                ]}
              />
              <Text style={styles.slotTitle}>{nameOf(slot.characterId!)}</Text>
            </View>
            <Text style={styles.modeLabel}>{t('mode')}</Text>
            <Select
              options={modeOptions}
              value={slot.modeId ?? ''}
              onValueChange={(value) =>
                setSlots((current) =>
                  current.map((item) =>
                    item.key === slot.key ? { ...item, modeId: value ? value : null } : item,
                  ),
                )
              }
              placeholder={t('mode_normal')}
              disabled={modeOptions.length === 1}
            />
          </View>
        );
      })}

      <View style={{ marginTop: 16 }}>
        <StatRadarChart
          layout={layout}
          emptyMessage={t('stat_needs_more_primaries', { count: MIN_PRIMARY_STATS_FOR_CHART })}
        />
      </View>

      {layout && layout.series.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{t('stats_title')}</Text>
          <View style={styles.valueHeader}>
            <Text style={[styles.valueStatName, { color: colors.textSecondary, fontSize: 12 }]}>
              {t('name')}
            </Text>
            {layout.series.map((series) => (
              <Text
                key={`head-${series.id}`}
                style={[styles.valueHeaderCell, { color: series.color }]}
                numberOfLines={1}
              >
                {series.label}
              </Text>
            ))}
          </View>
          {data.primaryStats.map((stat) => (
            <View key={stat.id} style={styles.valueRow}>
              <Text style={styles.valueStatName} numberOfLines={2}>
                {stat.name}
              </Text>
              {layout.series.map((series) => {
                const vertex = series.vertices.find((point) => point.statId === stat.id);
                return (
                  <Text
                    key={`${series.id}-${stat.id}`}
                    style={[styles.valueCell, { color: series.color }]}
                  >
                    {formatStatValueDetailed(
                      vertex?.value ?? null,
                      data.ladderOf(stat.id),
                      notation,
                    )}
                  </Text>
                );
              })}
            </View>
          ))}
        </>
      ) : null}

      {layout && layout.series.length > 0 ? (
        <Button onPress={handleExport} disabled={exporting} style={{ marginTop: 16 }}>
          {exporting ? t('saving') : t('stat_export')}
        </Button>
      ) : null}
    </ScrollView>
  );
};

export default StatComparisonScreen;

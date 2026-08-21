import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Select from '../../../common/inputs/Select/Select';
import { useResponsiveLayout } from '../../../../hooks/useResponsiveLayout';
import type { StoryStatsData } from '../../../../hooks/useStoryStats';
import { useTheme } from '../../../../theme';
import { formatStatValueDetailed, type StatNotation } from '../../../../utils/statLadder';
import {
  buildStatRadarLayout,
  MIN_PRIMARY_STATS_FOR_CHART,
} from '../../../../utils/statRadarLayout';
import { resolveStatValue } from '../../../../utils/statValues';
import { StatRadarChart } from '../StatRadarChart/StatRadarChart';

/**
 * O bloco de status na tela de detalhe do personagem. Não é `CollapsibleCard` de propósito: é a
 * leitura principal desta parte da tela, e o gráfico perde a graça atrás de um cabeçalho.
 *
 * Em tela estreita o gráfico vai em cima e a lista embaixo; a partir de médio os dois ficam
 * lado a lado, seguindo `GalleryDetailContent`.
 */
interface CharacterStatPanelProps {
  characterId: string;
  characterName: string;
  data: StoryStatsData;
  notation: StatNotation;
  onCompare?: (modeId: string | null) => void;
  onExport?: (modeId: string | null) => void;
}

const CHART_SIZE_COMPACT = 300;
const CHART_SIZE_WIDE = 340;

export function CharacterStatPanel({
  characterId,
  characterName,
  data,
  notation,
  onCompare,
  onExport,
}: CharacterStatPanelProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isCompact } = useResponsiveLayout();
  const [modeId, setModeId] = useState<string | null>(null);

  const characterModes = useMemo(
    () => data.modes.filter((mode) => mode.characterId === characterId),
    [data.modes, characterId],
  );

  const size = isCompact ? CHART_SIZE_COMPACT : CHART_SIZE_WIDE;
  const layout = useMemo(() => {
    const values = new Map<string, number | null>();
    for (const stat of data.primaryStats) {
      values.set(stat.id, resolveStatValue(data.valueIndex, characterId, modeId, stat.id).value);
    }
    return buildStatRadarLayout({
      stats: data.primaryStats.map((stat) => ({
        id: stat.id,
        name: stat.name,
        ladder: data.ladderOf(stat.id),
      })),
      series: [{ id: characterId, label: characterName, color: colors.primary, values }],
      notation,
      size,
    });
  }, [characterId, characterName, colors.primary, data, modeId, notation, size]);

  const rows = useMemo(
    () =>
      data.stats.map((stat) => {
        const resolved = resolveStatValue(data.valueIndex, characterId, modeId, stat.id);
        return {
          id: stat.id,
          name: stat.name,
          isPrimary: stat.isPrimary,
          inherited: resolved.inherited,
          display: formatStatValueDetailed(resolved.value, data.ladderOf(stat.id), notation),
        };
      }),
    [characterId, data, modeId, notation],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        layout: { gap: 16, marginTop: 4 },
        wideLayout: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
        chartColumn: { flexGrow: 0 },
        detailsColumn: { flex: 1 },
        header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
        modeSelect: { flex: 1, maxWidth: 260 },
        actionButton: { padding: 6 },
        sectionLabel: {
          color: colors.textSecondary,
          fontSize: 12,
          marginTop: 10,
          marginBottom: 4,
          textTransform: 'uppercase',
        },
        row: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 8,
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        rowName: { color: colors.text, fontSize: 15, flexShrink: 1, paddingRight: 8 },
        rowValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
        inherited: { color: colors.textSecondary, fontWeight: '400' },
        empty: { color: colors.textSecondary, paddingVertical: 8 },
      }),
    [colors],
  );

  const modeOptions = useMemo(
    () => [
      { label: t('mode_normal'), value: '' },
      ...characterModes.map((mode) => ({ label: mode.name, value: mode.id })),
    ],
    [characterModes, t],
  );

  const primaryRows = rows.filter((row) => row.isPrimary);
  const secondaryRows = rows.filter((row) => !row.isPrimary);

  const renderRow = (row: (typeof rows)[number]) => (
    <View key={row.id} style={styles.row}>
      <Text style={styles.rowName} numberOfLines={2}>
        {row.name}
      </Text>
      <Text style={[styles.rowValue, row.inherited && styles.inherited]}>
        {row.display}
        {row.inherited ? ` · ${t('stat_inherited')}` : ''}
      </Text>
    </View>
  );

  const chart = (
    <StatRadarChart
      layout={layout}
      emptyMessage={t('stat_needs_more_primaries', { count: MIN_PRIMARY_STATS_FOR_CHART })}
    />
  );

  const details = (
    <View>
      {rows.length === 0 ? <Text style={styles.empty}>{t('stat_no_values')}</Text> : null}
      {primaryRows.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>{t('stat_primary_section')}</Text>
          {primaryRows.map(renderRow)}
        </>
      ) : null}
      {secondaryRows.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>{t('stat_secondary_section')}</Text>
          {secondaryRows.map(renderRow)}
        </>
      ) : null}
    </View>
  );

  return (
    <View>
      <View style={styles.header}>
        {characterModes.length > 0 ? (
          <View style={styles.modeSelect}>
            <Select
              options={modeOptions}
              value={modeId ?? ''}
              onValueChange={(value) => setModeId(value ? value : null)}
              placeholder={t('mode_normal')}
            />
          </View>
        ) : null}
        {onCompare ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onCompare(modeId)}
            accessibilityLabel={t('stat_compare_title')}
          >
            <Ionicons name="stats-chart-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        {onExport && layout ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onExport(modeId)}
            accessibilityLabel={t('stat_export')}
          >
            <Ionicons name="download-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={[styles.layout, !isCompact && styles.wideLayout]}>
        <View style={!isCompact ? styles.chartColumn : undefined}>{chart}</View>
        <View style={!isCompact ? styles.detailsColumn : undefined}>{details}</View>
      </View>
    </View>
  );
}

export default CharacterStatPanel;

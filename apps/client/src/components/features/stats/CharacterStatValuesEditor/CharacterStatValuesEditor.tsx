import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ResponsiveGrid from '../../../layout/ResponsiveGrid/ResponsiveGrid';
import TextInput from '../../../common/inputs/TextInput/TextInput';
import CollapsibleCard from '../../../common/display/CollapsibleCard/CollapsibleCard';
import { useResponsiveLayout } from '../../../../hooks/useResponsiveLayout';
import type { StoryStatsData } from '../../../../hooks/useStoryStats';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';
import { AppAlert } from '../../../../utils/AppAlert';
import { formatStatNumber, formatTierLabel } from '@keres/shared/graphs/statLadder';
import { StatLadderBar } from '../StatLadderBar/StatLadderBar';
import { resolveStatValue } from '../../../../utils/statValues';

/**
 * A character's stat values, per mode.
 *
 * A mode with no value of its own inherits the normal mode's: the field shows the inherited value
 * greyed out and only writes a row when the author types, which is exactly the act of no longer
 * inheriting. Clearing the field deletes the row and gives the inheritance back.
 */
interface CharacterStatValuesEditorProps {
  characterId: string;
  data: StoryStatsData;
  editable: boolean;
  onSetValue: (params: { modeId: string | null; statId: string; value: number }) => Promise<void>;
  onClearValue: (params: { modeId: string | null; statId: string }) => Promise<void>;
}

export function CharacterStatValuesEditor({
  characterId,
  data,
  editable,
  onSetValue,
  onClearValue,
}: CharacterStatValuesEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isCompact } = useResponsiveLayout();
  const commonInputStyles = getCommonInputStyles(colors);
  const [modeId, setModeId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const characterModes = useMemo(
    () => data.modes.filter((mode) => mode.characterId === characterId),
    [data.modes, characterId],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        tabs: { flexGrow: 0, marginBottom: 14 },
        tab: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 20,
          marginRight: 8,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        tabText: { color: colors.text, fontSize: 14 },
        tabTextActive: { color: colors.onPrimary, fontWeight: 'bold' },
        statBlock: { marginBottom: 16 },
        // From medium up each stat becomes a card: it groups the name, the field and the ladder, and keeps the
        // bar at a readable length instead of stretched across the whole screen.
        card: {
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        },
        row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
        name: { color: colors.text, flex: 1, fontSize: 15 },
        cardName: { fontWeight: '600' },
        // The rank of the typed value, said in words: the ladder shows where the point landed, the badge gives
        // the tier's name, which is what ladders with arbitrary steps hide.
        tierBadge: {
          minWidth: 38,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          flexGrow: 0,
          flexShrink: 0,
        },
        tierBadgeText: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
        tierBadgeEmpty: { color: colors.textSecondary, fontWeight: 'normal' },
        input: { flex: 1 },
        // A numeric field does not need half a screen; a fixed width keeps the cards aligned.
        // `flex: 0` is no good here: on react-native-web it becomes the CSS shorthand `flex: 0`, whose
        // `flex-basis: 0%` cancels the width and collapses the field. Explicit grow/shrink preserve the
        // `auto` basis, and then the width holds on both platforms.
        cardInput: { width: 104, flexGrow: 0, flexShrink: 0 },
        hint: { color: colors.textSecondary, fontSize: 12, marginBottom: 12 },
        empty: { color: colors.textSecondary, paddingVertical: 12 },
      }),
    [colors],
  );

  const commit = async (statId: string, raw: string) => {
    const key = `${modeId ?? ''}:${statId}`;
    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    try {
      if (raw.trim() === '') {
        await onClearValue({ modeId, statId });
        return;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        AppAlert.alert(t('error'), t('stat_tier_value_invalid'));
        return;
      }
      await onSetValue({ modeId, statId, value });
    } catch (error: any) {
      console.error('Failed to save stat value:', error);
      AppAlert.alert(t('error'), error?.message || t('stat_value_save_failed'));
    }
  };

  const renderStat = (stat: StoryStatsData['stats'][number]) => {
    const key = `${modeId ?? ''}:${stat.id}`;
    const resolved = resolveStatValue(data.valueIndex, characterId, modeId, stat.id);
    const draft = drafts[key];
    const shown = draft ?? (resolved.inherited ? '' : (resolved.value?.toString() ?? ''));
    // Inherited: the field shows empty and the placeholder carries the number being inherited, which is
    // exactly what typing over it replaces.
    const placeholder = resolved.inherited
      ? formatStatNumber(resolved.value)
      : t('stat_value_placeholder');
    // The ladder follows what is being typed, not only what has been saved: it is what answers
    // "where does the 250 I just wrote land" without having to save to find out.
    const typed = Number(shown);
    const previewValue = shown.trim() !== '' && Number.isFinite(typed) ? typed : resolved.value;
    const ladder = data.ladderOf(stat.id);

    return (
      <>
        <View style={styles.row}>
          <Text style={[styles.name, !isCompact && styles.cardName]} numberOfLines={2}>
            {stat.name}
          </Text>
          <View style={styles.tierBadge}>
            <Text style={[styles.tierBadgeText, previewValue === null && styles.tierBadgeEmpty]}>
              {formatTierLabel(previewValue, ladder)}
            </Text>
          </View>
          <View style={isCompact ? styles.input : styles.cardInput}>
            <TextInput
              value={shown}
              onChangeText={(value) => setDrafts((current) => ({ ...current, [key]: value }))}
              onBlur={() => commit(stat.id, shown)}
              placeholder={placeholder}
              keyboardType="numeric"
              editable={editable}
              style={commonInputStyles.input}
            />
          </View>
        </View>
        <StatLadderBar ladder={ladder} value={previewValue} />
      </>
    );
  };

  return (
    <CollapsibleCard title={t('stats_title')}>
      {characterModes.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {[{ id: null, name: t('mode_normal') }, ...characterModes].map((mode) => (
            <TouchableOpacity
              key={mode.id ?? 'normal'}
              onPress={() => setModeId(mode.id)}
              style={[styles.tab, modeId === mode.id && styles.tabActive]}
            >
              <Text style={[styles.tabText, modeId === mode.id && styles.tabTextActive]}>
                {mode.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {modeId ? <Text style={styles.hint}>{t('stat_mode_inherit_hint')}</Text> : null}

      {data.stats.length === 0 ? <Text style={styles.empty}>{t('stats_empty')}</Text> : null}
      {isCompact ? (
        data.stats.map((stat) => (
          <View key={stat.id} style={styles.statBlock}>
            {renderStat(stat)}
          </View>
        ))
      ) : (
        <ResponsiveGrid compactColumns={1} mediumColumns={2} wideColumns={3} gap={12}>
          {data.stats.map((stat) => (
            <View key={stat.id} style={styles.card}>
              {renderStat(stat)}
            </View>
          ))}
        </ResponsiveGrid>
      )}
    </CollapsibleCard>
  );
}

export default CharacterStatValuesEditor;

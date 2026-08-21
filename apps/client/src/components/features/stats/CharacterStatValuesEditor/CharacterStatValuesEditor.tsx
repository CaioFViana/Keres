import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextInput from '../../../common/inputs/TextInput/TextInput';
import CollapsibleCard from '../../../common/display/CollapsibleCard/CollapsibleCard';
import type { StoryStatsData } from '../../../../hooks/useStoryStats';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';
import { AppAlert } from '../../../../utils/AppAlert';
import { formatStatValue, type StatNotation } from '../../../../utils/statLadder';
import { resolveStatValue } from '../../../../utils/statValues';

/**
 * Os valores de status de um personagem, por modo.
 *
 * Um modo sem valor próprio herda o do modo normal: o campo mostra o valor herdado esmaecido e
 * só grava uma linha quando o autor digita, que é exatamente o ato de deixar de herdar. Limpar
 * o campo apaga a linha e devolve a herança.
 */
interface CharacterStatValuesEditorProps {
  characterId: string;
  data: StoryStatsData;
  notation: StatNotation;
  editable: boolean;
  onSetValue: (params: { modeId: string | null; statId: string; value: number }) => Promise<void>;
  onClearValue: (params: { modeId: string | null; statId: string }) => Promise<void>;
}

export function CharacterStatValuesEditor({
  characterId,
  data,
  notation,
  editable,
  onSetValue,
  onClearValue,
}: CharacterStatValuesEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
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
        tabs: { flexGrow: 0, marginBottom: 10 },
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
        row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
        name: { color: colors.text, flex: 1, fontSize: 15 },
        input: { flex: 1 },
        hint: { color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
        empty: { color: colors.textSecondary, paddingVertical: 8 },
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

      {modeId ? <Text style={styles.hint}>{t('stat_inherited')}</Text> : null}

      {data.stats.length === 0 ? <Text style={styles.empty}>{t('stats_empty')}</Text> : null}
      {data.stats.map((stat) => {
        const key = `${modeId ?? ''}:${stat.id}`;
        const resolved = resolveStatValue(data.valueIndex, characterId, modeId, stat.id);
        const draft = drafts[key];
        const shown = draft ?? (resolved.inherited ? '' : (resolved.value?.toString() ?? ''));
        const placeholder = resolved.inherited
          ? formatStatValue(resolved.value, data.ladderOf(stat.id), notation)
          : t('stat_value_placeholder');
        return (
          <View key={stat.id} style={styles.row}>
            <Text style={styles.name} numberOfLines={2}>
              {stat.name}
            </Text>
            <View style={styles.input}>
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
        );
      })}
    </CollapsibleCard>
  );
}

export default CharacterStatValuesEditor;

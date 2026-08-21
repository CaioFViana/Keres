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
import { formatStatNumber, formatTierLabel } from '../../../../utils/statLadder';
import { StatLadderBar } from '../StatLadderBar/StatLadderBar';
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
        // A partir de médio cada status vira um cartão: agrupa nome, campo e régua, e mantém a
        // barra num comprimento legível em vez de esticada pela tela inteira.
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
        // O rank do valor digitado, dito em texto: a régua mostra onde o ponto caiu, o selo diz
        // o nome do degrau, que é o que escadas de pisos arbitrários escondem.
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
        // Um campo numérico não precisa de meia tela; largura fixa deixa os cartões alinhados.
        // `flex: 0` aqui não serve: no react-native-web ele vira o atalho CSS `flex: 0`, cujo
        // `flex-basis: 0%` anula a largura e colapsa o campo. Grow/shrink explícitos preservam a
        // base `auto`, e aí a largura vale nas duas plataformas.
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
    // Herdado: o campo mostra vazio e o placeholder traz o número que está sendo herdado, que é
    // exatamente o que digitar por cima substitui.
    const placeholder = resolved.inherited
      ? formatStatNumber(resolved.value)
      : t('stat_value_placeholder');
    // A régua segue o que está sendo digitado, e não só o que já foi salvo: é o que responde
    // "onde cai o 250 que acabei de escrever" sem precisar salvar para descobrir.
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

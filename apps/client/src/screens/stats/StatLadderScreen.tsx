import { Ionicons } from '@expo/vector-icons';
import { type RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '../../components/common/controls/Button/Button';
import ThemedSwitch from '../../components/common/controls/ThemedSwitch/ThemedSwitch';
import TextInput from '../../components/common/inputs/TextInput/TextInput';
import KeyboardAwareScreen from '../../components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStoryStats } from '../../hooks/useStoryStats';
import { StatsStackParamList } from '../../navigation/StatsStack';
import { createStatStrengthService } from '../../services/storymanagement/StatStrengthService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { useDocumentTitle } from '../../utils/documentTitle';
import { generateNumericLadder } from '../../utils/statLadder';

type StatLadderNavigationProp = NativeStackNavigationProp<StatsStackParamList, 'StatLadder'>;

interface DraftTier {
  /** Chave só do rascunho; degraus já salvos carregam também o id do banco. */
  key: string;
  id?: string;
  label: string;
  minValue: string;
}

let draftCounter = 0;
const newDraftKey = () => `draft-${(draftCounter += 1)}`;

/**
 * Editor da escada de tiers. `statId` ausente edita a escada padrão da história; presente,
 * edita (ou cria) a escada exclusiva daquele status.
 *
 * A tela salva o conjunto inteiro de uma vez (`replaceLadder`) em vez de gravar cada tecla:
 * uma escada é um todo coerente, e trocar dois pisos de lugar passaria por um estado inválido
 * se cada linha fosse salva sozinha.
 */
const StatLadderScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<StatLadderNavigationProp>();
  const route = useRoute<RouteProp<StatsStackParamList, 'StatLadder'>>();
  const statId = route.params?.statId ?? null;
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const isNumeric = selectedStory?.statNotation === 'number';
  const data = useStoryStats(storyId);
  const scrollBottomPadding = useFormScrollBottomPadding();

  const stat = statId ? data.stats.find((row) => row.id === statId) : undefined;
  const ownRows = useMemo(
    () => data.strengths.filter((row) => row.statId === statId),
    [data.strengths, statId],
  );

  const [hasOwnLadder, setHasOwnLadder] = useState(false);
  const [tiers, setTiers] = useState<DraftTier[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatorMin, setGeneratorMin] = useState('0');
  const [generatorMax, setGeneratorMax] = useState('100');
  const [generatorStep, setGeneratorStep] = useState('10');

  const title = stat ? `${stat.name} · ${t('stat_ladder_title')}` : t('stat_ladder_default_title');
  useDocumentTitle(title);
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title });
    }, [navigation, title]),
  );

  useEffect(() => {
    if (hydrated || data.loading) return;
    const source = statId && ownRows.length === 0 ? data.defaultLadder : ownRows;
    setHasOwnLadder(!statId || ownRows.length > 0);
    setTiers(
      [...source]
        .sort((a, b) => a.minValue - b.minValue)
        .map((row) => ({
          key: newDraftKey(),
          // Ao herdar a escada padrão como ponto de partida, os degraus entram sem id: eles
          // serão criados como linhas novas deste status, não movidos da escada padrão.
          id: statId && ownRows.length === 0 ? undefined : (row as { id?: string }).id,
          label: row.label,
          minValue: String(row.minValue),
        })),
    );
    setHydrated(true);
  }, [data.defaultLadder, data.loading, hydrated, ownRows, statId]);

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        label: {
          color: colors.text,
          fontSize: 16,
          fontWeight: 'bold',
          marginTop: 8,
          marginBottom: 8,
        },
        hint: { color: colors.textSecondary, marginBottom: 12 },
        switchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        },
        tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
        tierLabel: { flex: 2 },
        tierValue: { flex: 1 },
        iconButton: { padding: 8 },
        generator: {
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 8,
          padding: 12,
          marginTop: 8,
          marginBottom: 16,
        },
        generatorRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 12 },
        empty: { color: colors.textSecondary, marginBottom: 12 },
      }),
    [colors],
  );

  const addTier = () =>
    setTiers((current) => [...current, { key: newDraftKey(), label: '', minValue: '' }]);

  const updateTier = (key: string, patch: Partial<DraftTier>) =>
    setTiers((current) => current.map((tier) => (tier.key === key ? { ...tier, ...patch } : tier)));

  const removeTier = (key: string) =>
    setTiers((current) => current.filter((tier) => tier.key !== key));

  const handleGenerate = () => {
    try {
      const generated = generateNumericLadder(
        Number(generatorMin),
        Number(generatorMax),
        Number(generatorStep),
      );
      setTiers(
        generated.map((tier) => ({
          key: newDraftKey(),
          label: tier.label,
          minValue: String(tier.minValue),
        })),
      );
    } catch (error: any) {
      AppAlert.alert(t('error'), error?.message || t('stat_tier_value_invalid'));
    }
  };

  const handleSave = useCallback(async () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!storyId) {
      AppAlert.alert(t('error'), t('no_story_selected'));
      return;
    }

    const wanted = statId && !hasOwnLadder ? [] : tiers;
    const parsed: { id?: string; label: string; minValue: number }[] = [];
    for (const tier of wanted) {
      if (!tier.label.trim()) {
        AppAlert.alert(t('error'), t('stat_tier_label_required'));
        return;
      }
      const minValue = Number(tier.minValue);
      if (!Number.isFinite(minValue) || minValue < 0 || tier.minValue.trim() === '') {
        AppAlert.alert(t('error'), t('stat_tier_value_invalid'));
        return;
      }
      parsed.push({ id: tier.id, label: tier.label.trim(), minValue });
    }
    if (new Set(parsed.map((tier) => tier.minValue)).size !== parsed.length) {
      AppAlert.alert(t('error'), t('stat_tier_duplicate_value'));
      return;
    }

    setSaving(true);
    try {
      await createStatStrengthService(drizzleDb).replaceLadder(userId, storyId, statId, parsed);
      navigation.goBack();
    } catch (error: any) {
      console.error('Failed to save stat ladder:', error);
      AppAlert.alert(t('error'), error?.message || t('stat_ladder_save_failed'));
    } finally {
      setSaving(false);
    }
  }, [drizzleDb, hasOwnLadder, navigation, statId, storyId, t, tiers, userId]);

  const editingOwnLadder = !statId || hasOwnLadder;

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={{ padding: 20, paddingBottom: scrollBottomPadding, flexGrow: 1 }}
    >
      {statId ? (
        <View style={styles.switchRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.label}>{t('stat_ladder_own')}</Text>
            <Text style={styles.hint}>{t('stat_ladder_own_hint')}</Text>
          </View>
          <ThemedSwitch value={hasOwnLadder} onValueChange={setHasOwnLadder} />
        </View>
      ) : null}

      {editingOwnLadder ? (
        <>
          <Text style={styles.label}>{t('stat_ladder_title')}</Text>
          {tiers.length === 0 ? <Text style={styles.empty}>{t('stats_empty')}</Text> : null}
          {tiers.map((tier) => (
            <View key={tier.key} style={styles.tierRow}>
              <View style={styles.tierLabel}>
                <TextInput
                  value={tier.label}
                  onChangeText={(value) => updateTier(tier.key, { label: value })}
                  placeholder={t('stat_tier_label')}
                  style={commonInputStyles.input}
                />
              </View>
              <View style={styles.tierValue}>
                <TextInput
                  value={tier.minValue}
                  onChangeText={(value) => updateTier(tier.key, { minValue: value })}
                  placeholder={t('stat_tier_min_value')}
                  keyboardType="numeric"
                  style={commonInputStyles.input}
                />
              </View>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => removeTier(tier.key)}
                accessibilityLabel={t('delete')}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          <Button onPress={addTier} style={{ marginBottom: 16 }}>
            {t('stat_tier_add')}
          </Button>

          {isNumeric ? (
            <View style={styles.generator}>
              <Text style={styles.label}>{t('stat_ladder_generator_title')}</Text>
              <View style={styles.generatorRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={generatorMin}
                    onChangeText={setGeneratorMin}
                    placeholder={t('stat_ladder_generator_min')}
                    keyboardType="numeric"
                    style={commonInputStyles.input}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={generatorMax}
                    onChangeText={setGeneratorMax}
                    placeholder={t('stat_ladder_generator_max')}
                    keyboardType="numeric"
                    style={commonInputStyles.input}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={generatorStep}
                    onChangeText={setGeneratorStep}
                    placeholder={t('stat_ladder_generator_step')}
                    keyboardType="numeric"
                    style={commonInputStyles.input}
                  />
                </View>
              </View>
              <Button onPress={handleGenerate}>{t('stat_ladder_generate')}</Button>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.hint}>{t('stat_ladder_own_hint')}</Text>
      )}

      <Button onPress={handleSave} disabled={saving}>
        {saving ? t('saving') : t('save')}
      </Button>
    </KeyboardAwareScreen>
  );
};

export default StatLadderScreen;

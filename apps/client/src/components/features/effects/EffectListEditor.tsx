import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { Effect } from '@keres/shared/entities/Effect';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useTheme } from '@/src/theme';

type EffectDraft = Pick<Effect, 'id' | 'effectType' | 'itemId' | 'triggerName'>;

interface EffectListEditorProps {
  effects: EffectDraft[];
  effectTypeOptions?: { label: string; value: string }[];
  itemOptions: { label: string; value: string }[];
  itemLabel: string;
  inputStyle: StyleProp<TextStyle>;
  onChangeType: (effectId: string, effectType: Effect['effectType']) => void;
  onUpdate: (
    effectId: string,
    changes: { itemId?: string | null; triggerName?: string | null },
  ) => void;
  onDelete: (effectId: string) => void;
  onAdd: () => void;
}

export default function EffectListEditor({
  effects,
  effectTypeOptions,
  itemOptions,
  itemLabel,
  inputStyle,
  onChangeType,
  onUpdate,
  onDelete,
  onAdd,
}: EffectListEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const resolvedTypeOptions = effectTypeOptions ?? [
    { label: t('effect_type_item_grant'), value: 'itemGrant' },
    { label: t('effect_type_item_take'), value: 'itemTake' },
    { label: t('effect_type_trigger_set'), value: 'triggerSet' },
    { label: t('effect_type_trigger_unset'), value: 'triggerUnset' },
  ];
  const styles = StyleSheet.create({
    section: { marginTop: 20, marginBottom: 20 },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    cardRowLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
    fieldFlex: { flex: 1 },
    removeLink: { color: colors.error, fontWeight: '600' },
    addLink: { color: colors.primary, fontWeight: '600', marginTop: 4 },
    empty: { color: colors.textSecondary, marginBottom: 10 },
  });

  return (
    <View style={styles.section}>
      <ScreenSection title={t('effects_title')} />
      {effects.map((effect) => (
        <View key={effect.id} style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.fieldFlex}>
              <Text style={styles.cardRowLabel}>{t('effect_type')}</Text>
              <SingleSelectPill
                options={resolvedTypeOptions}
                value={effect.effectType}
                onValueChange={(value) =>
                  value && onChangeType(effect.id, value as Effect['effectType'])
                }
                multiple={false}
              />
            </View>
          </View>
          {(effect.effectType === 'itemGrant' || effect.effectType === 'itemTake') && (
            <View style={styles.cardRow}>
              <View style={styles.fieldFlex}>
                <Text style={styles.cardRowLabel}>{itemLabel}</Text>
                <SingleSelectPill
                  options={itemOptions}
                  value={effect.itemId}
                  onValueChange={(value) => onUpdate(effect.id, { itemId: value })}
                  placeholder={t('select_item')}
                  multiple={false}
                  allowDeselect={true}
                />
              </View>
            </View>
          )}
          {(effect.effectType === 'triggerSet' || effect.effectType === 'triggerUnset') && (
            <View style={styles.cardRow}>
              <View style={styles.fieldFlex}>
                <Text style={styles.cardRowLabel}>{t('check_trigger_name')}</Text>
                <TextInput
                  placeholder={t('check_trigger_name_placeholder')}
                  value={effect.triggerName || ''}
                  onChangeText={(value) => onUpdate(effect.id, { triggerName: value || null })}
                  style={inputStyle}
                />
              </View>
            </View>
          )}
          <TouchableOpacity onPress={() => onDelete(effect.id)}>
            <Text style={styles.removeLink}>{t('remove_effect')}</Text>
          </TouchableOpacity>
        </View>
      ))}
      {effects.length === 0 && <Text style={styles.empty}>{t('no_effects')}</Text>}
      <TouchableOpacity onPress={onAdd}>
        <Text style={styles.addLink}>{t('add_effect')}</Text>
      </TouchableOpacity>
    </View>
  );
}

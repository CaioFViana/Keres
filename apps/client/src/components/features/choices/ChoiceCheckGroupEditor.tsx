import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { ChoiceCheck } from '@keres/shared/entities/ChoiceCheck';
import type { ChoiceCheckGroup } from '@keres/shared/entities/ChoiceCheckGroup';
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

interface SelectOption {
  label: string;
  value: string;
}

interface ChoiceCheckGroupEditorProps {
  checkGroups: ChoiceCheckGroup[];
  checks: ChoiceCheck[];
  combinatorOptions: SelectOption[];
  checkTypeOptions: SelectOption[];
  checkModeOptions: SelectOption[];
  sceneOptions: SelectOption[];
  itemOptions: SelectOption[];
  itemPresenceOptions: SelectOption[];
  triggerStateOptions: SelectOption[];
  scenePlaceholder: string;
  inputStyle: StyleProp<TextStyle>;
  onUpdateCombinator: (groupId: string, combinator: 'AND' | 'OR') => void;
  onDeleteGroup: (groupId: string) => void;
  onAddGroup: () => void;
  onChangeCheckType: (checkId: string, type: ChoiceCheck['type']) => void;
  onUpdateCheck: (
    checkId: string,
    changes: Partial<
      Pick<
        ChoiceCheck,
        | 'mode'
        | 'sceneId'
        | 'minVisits'
        | 'itemId'
        | 'itemPresence'
        | 'triggerName'
        | 'triggerState'
      >
    >,
  ) => void;
  onDeleteCheck: (checkId: string) => void;
  onAddCheck: (groupId: string) => void;
}

export default function ChoiceCheckGroupEditor({
  checkGroups,
  checks,
  combinatorOptions,
  checkTypeOptions,
  checkModeOptions,
  sceneOptions,
  itemOptions,
  itemPresenceOptions,
  triggerStateOptions,
  scenePlaceholder,
  inputStyle,
  onUpdateCombinator,
  onDeleteGroup,
  onAddGroup,
  onChangeCheckType,
  onUpdateCheck,
  onDeleteCheck,
  onAddCheck,
}: ChoiceCheckGroupEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    section: { marginTop: 20 },
    sectionDescription: { color: colors.textSecondary, marginBottom: 10 },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    checkCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 10,
      marginTop: 8,
      backgroundColor: colors.background,
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
      <ScreenSection title={t('checks_title')} />
      <Text style={styles.sectionDescription}>{t('checks_groups_and_note')}</Text>

      {checkGroups.map((group) => {
        const groupChecks = checks.filter((check) => check.groupId === group.id);
        return (
          <View key={group.id} style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.fieldFlex}>
                <Text style={styles.cardRowLabel}>{t('check_group_combinator')}</Text>
                <SingleSelectPill
                  options={combinatorOptions}
                  value={group.combinator}
                  onValueChange={(value) =>
                    value && onUpdateCombinator(group.id, value as 'AND' | 'OR')
                  }
                  multiple={false}
                />
              </View>
              <TouchableOpacity onPress={() => onDeleteGroup(group.id)}>
                <Text style={styles.removeLink}>{t('remove_check_group')}</Text>
              </TouchableOpacity>
            </View>

            {groupChecks.length === 0 && (
              <Text style={{ color: colors.textSecondary }}>{t('no_checks_in_group')}</Text>
            )}

            {groupChecks.map((check) => (
              <View key={check.id} style={styles.checkCard}>
                <View style={styles.cardRow}>
                  <View style={styles.fieldFlex}>
                    <Text style={styles.cardRowLabel}>{t('check_type')}</Text>
                    <SingleSelectPill
                      options={checkTypeOptions}
                      value={check.type}
                      onValueChange={(value) =>
                        value && onChangeCheckType(check.id, value as ChoiceCheck['type'])
                      }
                      multiple={false}
                    />
                  </View>
                  <View style={styles.fieldFlex}>
                    <Text style={styles.cardRowLabel}>{t('check_mode')}</Text>
                    <SingleSelectPill
                      options={checkModeOptions}
                      value={check.mode}
                      onValueChange={(value) =>
                        value && onUpdateCheck(check.id, { mode: value as 'block' | 'enable' })
                      }
                      multiple={false}
                    />
                  </View>
                </View>

                {check.type === 'sceneCount' && (
                  <View style={styles.cardRow}>
                    <View style={styles.fieldFlex}>
                      <Text style={styles.cardRowLabel}>{t('check_scene')}</Text>
                      <SingleSelectPill
                        options={sceneOptions}
                        value={check.sceneId}
                        onValueChange={(value) => onUpdateCheck(check.id, { sceneId: value })}
                        placeholder={scenePlaceholder}
                        multiple={false}
                        allowDeselect={true}
                      />
                    </View>
                    <View style={styles.fieldFlex}>
                      <Text style={styles.cardRowLabel}>{t('check_min_visits')}</Text>
                      <TextInput
                        placeholder={t('check_min_visits_placeholder')}
                        value={check.minVisits !== null ? String(check.minVisits) : ''}
                        onChangeText={(value) =>
                          onUpdateCheck(check.id, { minVisits: value ? Number(value) : null })
                        }
                        keyboardType="numeric"
                        style={inputStyle}
                      />
                    </View>
                  </View>
                )}

                {check.type === 'inventory' && (
                  <View style={styles.cardRow}>
                    <View style={styles.fieldFlex}>
                      <Text style={styles.cardRowLabel}>{t('check_item')}</Text>
                      <SingleSelectPill
                        options={itemOptions}
                        value={check.itemId}
                        onValueChange={(value) => onUpdateCheck(check.id, { itemId: value })}
                        placeholder={t('select_item')}
                        multiple={false}
                        allowDeselect={true}
                      />
                    </View>
                    <View style={styles.fieldFlex}>
                      <Text style={styles.cardRowLabel}>{t('check_item_presence')}</Text>
                      <SingleSelectPill
                        options={itemPresenceOptions}
                        value={check.itemPresence}
                        onValueChange={(value) =>
                          value &&
                          onUpdateCheck(check.id, { itemPresence: value as 'has' | 'lacks' })
                        }
                        multiple={false}
                      />
                    </View>
                  </View>
                )}

                {check.type === 'trigger' && (
                  <View style={styles.cardRow}>
                    <View style={styles.fieldFlex}>
                      <Text style={styles.cardRowLabel}>{t('check_trigger_name')}</Text>
                      <TextInput
                        placeholder={t('check_trigger_name_placeholder')}
                        value={check.triggerName || ''}
                        onChangeText={(value) =>
                          onUpdateCheck(check.id, { triggerName: value || null })
                        }
                        style={inputStyle}
                      />
                    </View>
                    <View style={styles.fieldFlex}>
                      <Text style={styles.cardRowLabel}>{t('check_trigger_state')}</Text>
                      <SingleSelectPill
                        options={triggerStateOptions}
                        value={check.triggerState}
                        onValueChange={(value) =>
                          value &&
                          onUpdateCheck(check.id, { triggerState: value as 'set' | 'unset' })
                        }
                        multiple={false}
                      />
                    </View>
                  </View>
                )}

                <TouchableOpacity onPress={() => onDeleteCheck(check.id)}>
                  <Text style={styles.removeLink}>{t('remove_check')}</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity onPress={() => onAddCheck(group.id)}>
              <Text style={styles.addLink}>{t('add_check')}</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {checkGroups.length === 0 && <Text style={styles.empty}>{t('no_check_groups')}</Text>}
      <TouchableOpacity onPress={onAddGroup}>
        <Text style={styles.addLink}>{t('add_check_group')}</Text>
      </TouchableOpacity>
    </View>
  );
}

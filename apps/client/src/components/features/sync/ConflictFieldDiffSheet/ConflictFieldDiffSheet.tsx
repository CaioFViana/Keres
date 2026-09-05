import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ConflictSummary } from '../../../../services/ConflictSummaryService';
import type { PendingConflict } from '../../../../services/SyncConflictService';
import { useSyncConflictActions } from '../../../../hooks/useSyncConflictActions';
import { useTheme } from '../../../../theme';
import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { AppAlert } from '@/src/utils/AppAlert';

/** De qual lado vem o valor escolhido para um campo em disputa. */
type FieldChoice = 'local' | 'server';

interface ConflictFieldDiffSheetProps {
  conflict: PendingConflict;
  summary: ConflictSummary;
  visible: boolean;
  onClose: () => void;
}

/**
 * The field-by-field diff drill-in - the original `SyncConflictModal.tsx` logic, only reachable for
 * `kind === 'content'` conflicts with multiple genuinely disputed fields (`summary.diffFields`, already
 * with names resolved instead of raw IDs when a field points at another entity). It never opens for any
 * of the 8 relation types - those are resolved with a single tap in the list.
 */
const ConflictFieldDiffSheet: React.FC<ConflictFieldDiffSheetProps> = ({
  conflict,
  summary,
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isResolving, keepLocal, keepServer } = useSyncConflictActions();

  const [fieldChoices, setFieldChoices] = useState<Record<string, FieldChoice>>({});

  useEffect(() => {
    const defaults: Record<string, FieldChoice> = {};
    for (const field of summary.diffFields) {
      defaults[field.field] = 'local';
    }
    setFieldChoices(defaults);
  }, [conflict.id, summary.diffFields]);

  const hasServerChoice = useMemo(
    () => Object.values(fieldChoices).some((choice) => choice === 'server'),
    [fieldChoices],
  );

  const handleKeepMine = useCallback(async () => {
    const chosenValues = hasServerChoice
      ? Object.fromEntries(
          Object.entries(conflict.localValues).map(([field, localValue]) => [
            field,
            fieldChoices[field] === 'server' ? conflict.serverValues?.[field] : localValue,
          ]),
        )
      : undefined;
    await keepLocal(conflict.id, chosenValues);
    onClose();
  }, [conflict, fieldChoices, hasServerChoice, keepLocal, onClose]);

  const handleKeepServer = useCallback(async () => {
    await keepServer(conflict.id);
    onClose();
  }, [conflict.id, keepServer, onClose]);

  const keepMineLabel = hasServerChoice ? t('conflict_apply_merge') : t('conflict_keep_mine');

  const confirmKeepMine = useCallback(() => {
    AppAlert.alert(t('conflict_confirm_title'), t('conflict_confirm_keep_mine'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('conflict_confirm_action'), onPress: handleKeepMine },
    ]);
  }, [handleKeepMine, t]);

  const confirmKeepServer = useCallback(() => {
    AppAlert.alert(t('conflict_confirm_title'), t('conflict_confirm_keep_server'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('conflict_confirm_action'), style: 'destructive', onPress: handleKeepServer },
    ]);
  }, [handleKeepServer, t]);

  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
      maxHeight: '85%',
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    header: { flexDirection: 'row', alignItems: 'center' },
    headerText: { flex: 1, marginRight: 12 },
    title: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    closeButton: { padding: 4 },
    fieldBlock: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      marginTop: 14,
    },
    fieldName: {
      fontSize: 13,
      fontWeight: 'bold',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 6,
      marginBottom: 4,
    },
    optionSelected: { backgroundColor: colors.primaryContainer },
    optionLabel: { fontSize: 12, fontWeight: 'bold', color: colors.textSecondary, marginBottom: 2 },
    optionValue: { fontSize: 14, color: colors.text },
    optionTextWrapper: { flex: 1, marginLeft: 8 },
    footer: { marginTop: 18 },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: { color: colors.text, fontSize: 16, fontWeight: 'bold' },
  });

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      placement="adaptive"
      contentStyle={styles.sheet}
      maxHeight="85%"
    >
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('conflict_choose_per_field')}</Text>
          <Text style={styles.subtitle}>{`${summary.entityLabel} — ${summary.title}`}</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel={t('conflict_close_details')}
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView>
        {summary.diffFields.map((field) => {
          const choice = fieldChoices[field.field] || 'local';
          return (
            <View key={field.field} style={styles.fieldBlock}>
              <Text style={styles.fieldName}>{field.label}</Text>

              <TouchableOpacity
                style={[styles.option, choice === 'local' && styles.optionSelected]}
                onPress={() => setFieldChoices((prev) => ({ ...prev, [field.field]: 'local' }))}
                accessibilityRole="radio"
                accessibilityState={{ selected: choice === 'local' }}
                accessibilityLabel={`${field.label}: ${t('conflict_side_mine')}. ${field.localDisplay}`}
              >
                <Ionicons
                  name={choice === 'local' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={choice === 'local' ? colors.primary : colors.textSecondary}
                />
                <View style={styles.optionTextWrapper}>
                  <Text style={styles.optionLabel}>{t('conflict_side_mine')}</Text>
                  <Text style={styles.optionValue}>{field.localDisplay}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.option, choice === 'server' && styles.optionSelected]}
                onPress={() => setFieldChoices((prev) => ({ ...prev, [field.field]: 'server' }))}
                accessibilityRole="radio"
                accessibilityState={{ selected: choice === 'server' }}
                accessibilityLabel={`${field.label}: ${t('conflict_side_server')}. ${field.serverDisplay}`}
              >
                <Ionicons
                  name={choice === 'server' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={choice === 'server' ? colors.primary : colors.textSecondary}
                />
                <View style={styles.optionTextWrapper}>
                  <Text style={styles.optionLabel}>{t('conflict_side_server')}</Text>
                  <Text style={styles.optionValue}>{field.serverDisplay}</Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        })}

        <FormActions stackOnCompact style={styles.footer}>
          <Button
            onPress={confirmKeepMine}
            disabled={isResolving}
            accessibilityLabel={keepMineLabel}
            accessibilityHint={t('conflict_keep_mine_description')}
          >
            {keepMineLabel}
          </Button>
          <Button
            onPress={confirmKeepServer}
            disabled={isResolving}
            style={styles.secondaryButton}
            accessibilityLabel={t('conflict_keep_server')}
            accessibilityHint={t('conflict_keep_server_description')}
          >
            <Text style={styles.secondaryButtonText}>{t('conflict_keep_server')}</Text>
          </Button>
        </FormActions>
      </ScrollView>
    </ResponsiveModal>
  );
};

export default ConflictFieldDiffSheet;

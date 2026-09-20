import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../../../common/controls/Button/Button';
import { useTheme } from '../../../../theme';
import { manuscriptTextMetrics } from '../manuscriptTextMetrics';

export type SceneBodyFooterProps = {
  wordCount: number;
  charCount: number;
  maxLength: number;
  overLimit: boolean;
  canSave: boolean;
  saving: boolean;
  /** Dirty or restored-from-draft: there are changes the server has never seen. */
  hasUnsavedChanges: boolean;
  onSave(): void;
  testID?: string;
};

/** Fixed bottom bar of the prose editor: draft flag, counter and save. */
export function SceneBodyFooter({
  wordCount,
  charCount,
  maxLength,
  overLimit,
  canSave,
  saving,
  hasUnsavedChanges,
  onSave,
  testID,
}: SceneBodyFooterProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        bar: {
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingHorizontal: manuscriptTextMetrics.containerPaddingHorizontal,
          paddingVertical: 8,
        },
        row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        counter: { flex: 1, color: colors.textSecondary, fontSize: 13 },
        counterOver: { color: colors.error },
        draftFlag: { color: colors.notification, fontSize: 13 },
        hint: { color: colors.error, fontSize: 13, marginBottom: 8 },
      }),
    [colors],
  );
  return (
    <View style={styles.bar} testID={testID}>
      {overLimit && <Text style={styles.hint}>{t('manuscript_split_hint')}</Text>}
      {saving && <Text style={styles.counter}>{t('saving')}</Text>}
      <View style={styles.row}>
        {hasUnsavedChanges && !saving && (
          <Text style={styles.draftFlag}>{t('manuscript_unsaved_draft')}</Text>
        )}
        <Text style={[styles.counter, overLimit && styles.counterOver]}>
          {t('manuscript_counter', { words: wordCount, chars: charCount, max: maxLength })}
        </Text>
        <Button onPress={onSave} disabled={!canSave} testID={testID ? `${testID}.save` : undefined}>
          {t('save')}
        </Button>
      </View>
    </View>
  );
}

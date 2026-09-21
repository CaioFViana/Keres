import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../../../common/controls/Button/Button';
import { useTheme } from '../../../../theme';
import { manuscriptTextMetrics } from '../manuscriptTextMetrics';
import type { ManuscriptSizeStatus } from '../parseManuscriptMarkdown';

export type SceneBodyFooterProps = {
  wordCount: number;
  charCount: number;
  /** User-visible size band (20k nudge, 27k too large); advisory, never blocks. */
  sizeStatus: ManuscriptSizeStatus;
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
  sizeStatus,
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
        warningHint: { color: colors.notification, fontSize: 13, marginBottom: 8 },
      }),
    [colors],
  );
  // One hint at most: the blocking storage cap wins over the advisory size bands.
  let sizeHint: ReactNode = null;
  if (overLimit) {
    sizeHint = <Text style={styles.hint}>{t('manuscript_split_hint')}</Text>;
  } else if (sizeStatus === 'tooLarge') {
    sizeHint = <Text style={styles.hint}>{t('manuscript_size_too_large')}</Text>;
  } else if (sizeStatus === 'large') {
    sizeHint = <Text style={styles.warningHint}>{t('manuscript_size_large')}</Text>;
  }
  return (
    <View style={styles.bar} testID={testID}>
      {sizeHint}
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

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Button from '../../../common/controls/Button/Button';
import { useTheme } from '../../../../theme';
import { manuscriptTextMetrics } from '../manuscriptTextMetrics';

export type SceneBodyEditorProps = {
  value: string;
  onChangeText(text: string): void;
  wordCount: number;
  charCount: number;
  maxLength: number;
  overLimit: boolean;
  canSave: boolean;
  saving: boolean;
  /** Dirty or restored-from-draft: there are changes the server has never seen. */
  hasUnsavedChanges: boolean;
  onSave(): void;
  editable?: boolean;
  autoFocus?: boolean;
  testID?: string;
};

/**
 * The manuscript prose input, shared by the per-scene screen and the manuscript's
 * inline section. Borderless and metric-identical to `MarkdownPreview` so it swaps
 * in place without shifting the document.
 */
export function SceneBodyEditor({
  value,
  onChangeText,
  wordCount,
  charCount,
  maxLength,
  overLimit,
  canSave,
  saving,
  hasUnsavedChanges,
  onSave,
  editable = true,
  autoFocus = false,
  testID,
}: SceneBodyEditorProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        input: {
          color: colors.text,
          backgroundColor: colors.surface,
          fontSize: manuscriptTextMetrics.fontSize,
          lineHeight: manuscriptTextMetrics.lineHeight,
          paddingHorizontal: manuscriptTextMetrics.containerPaddingHorizontal,
          paddingVertical: manuscriptTextMetrics.containerPaddingVertical,
          textAlignVertical: 'top',
        },
        footer: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: manuscriptTextMetrics.containerPaddingHorizontal,
          paddingVertical: 8,
          gap: 12,
        },
        counter: {
          flex: 1,
          color: colors.textSecondary,
          fontSize: 13,
        },
        counterOver: { color: colors.error },
        draftFlag: { color: colors.notification, fontSize: 13 },
        hint: {
          color: colors.error,
          fontSize: 13,
          paddingHorizontal: manuscriptTextMetrics.containerPaddingHorizontal,
          paddingBottom: 8,
        },
      }),
    [colors],
  );
  return (
    <View testID={testID}>
      <TextInput
        testID={testID ? `${testID}.input` : undefined}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        multiline
        editable={editable && !saving}
        autoFocus={autoFocus}
        placeholder={t('manuscript_empty')}
        placeholderTextColor={colors.textSecondary}
        scrollEnabled={false}
      />
      {overLimit && <Text style={styles.hint}>{t('manuscript_split_hint')}</Text>}
      <View style={styles.footer}>
        {hasUnsavedChanges && (
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

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../../../../theme';
import type { TextSelection } from '../formatManuscriptSelection';
import { manuscriptTextMetrics } from '../manuscriptTextMetrics';

export type SceneBodyEditorProps = {
  value: string;
  onChangeText(text: string): void;
  selection?: TextSelection;
  onSelectionChange?(selection: TextSelection): void;
  editable?: boolean;
  autoFocus?: boolean;
  testID?: string;
};

/**
 * The manuscript prose input. Borderless and metric-identical to `MarkdownPreview`
 * so it swaps in place without shifting the document. It fills its scroll parent
 * (which must grow its content) and never scrolls itself; the toolbar and footer
 * are siblings owned by the host screen.
 */
export function SceneBodyEditor({
  value,
  onChangeText,
  selection,
  onSelectionChange,
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
          flex: 1,
          color: colors.text,
          backgroundColor: colors.surface,
          fontSize: manuscriptTextMetrics.fontSize,
          lineHeight: manuscriptTextMetrics.lineHeight,
          paddingHorizontal: manuscriptTextMetrics.containerPaddingHorizontal,
          paddingVertical: manuscriptTextMetrics.containerPaddingVertical,
          textAlignVertical: 'top',
        },
      }),
    [colors],
  );
  return (
    <View style={{ flex: 1 }} testID={testID}>
      <TextInput
        testID={testID ? `${testID}.input` : undefined}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        selection={selection}
        onSelectionChange={(event) => onSelectionChange?.(event.nativeEvent.selection)}
        multiline
        editable={editable}
        autoFocus={autoFocus}
        placeholder={t('manuscript_empty')}
        placeholderTextColor={colors.textSecondary}
        scrollEnabled={false}
      />
    </View>
  );
}

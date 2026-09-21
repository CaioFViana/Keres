import type { ManuscriptMark } from '@keres/shared';
import { useCallback, useMemo, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View, type NativeSyntheticEvent } from 'react-native';
import {
  EnrichedTextInput,
  type EnrichedTextInputInstance,
} from 'react-native-enriched-html';
import { useTheme } from '../../../../theme';
import { manuscriptTextMetrics } from '../manuscriptTextMetrics';

export type RichBodyEditorProps = {
  /** Initial HTML (uncontrolled input: later edits live natively, streamed out). */
  defaultHtml: string;
  onHtmlChange(html: string): void;
  onMarksChange(marks: ManuscriptMark[]): void;
  editable?: boolean;
  autoFocus?: boolean;
  testID?: string;
  /** Lets the host drive formatting imperatively (toolbar toggles, refocus). */
  inputRef?: RefObject<EnrichedTextInputInstance | null>;
};

type LibStyleState = {
  bold: { isActive: boolean };
  italic: { isActive: boolean };
  underline: { isActive: boolean };
  strikeThrough: { isActive: boolean };
};

function marksFromStyleState(state: LibStyleState): ManuscriptMark[] {
  const marks: ManuscriptMark[] = [];
  if (state.bold.isActive) marks.push('bold');
  if (state.italic.isActive) marks.push('italic');
  if (state.underline.isActive) marks.push('underline');
  if (state.strikeThrough.isActive) marks.push('strikethrough');
  return marks;
}

/**
 * The manuscript prose input: a native rich-text editor over the manuscript
 * document. Styling renders live as you type with a fully native caret,
 * selection and IME; the document model stays the storage truth via the
 * HTML boundary (`defaultHtml` in, `onHtmlChange` out), so drafts,
 * persistence, counts and export keep flowing serialized markdown untouched.
 */
export function RichBodyEditor(props: RichBodyEditorProps) {
  // Web-only: the TipTap host snapshots `editable` at creation and never
  // syncs it afterwards, while our `editable` starts false and resolves async
  // with the story role (and flips around saves) — remount the input when it
  // changes so read-only never sticks. The remount reseeds from the live doc
  // prop, so no typed content is lost. Native applies `editable` live.
  const editable = props.editable ?? true;
  const inputKey = Platform.OS === 'web' ? `editable-${editable}` : 'input';
  return <RichBodyEditorInner key={inputKey} {...props} />;
}

function RichBodyEditorInner({
  defaultHtml,
  onHtmlChange,
  onMarksChange,
  editable = true,
  autoFocus = false,
  testID,
  inputRef,
}: RichBodyEditorProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  // Mount-only seed: the web host keys its TipTap editor off `defaultValue`,
  // so a live-derived prop would destroy/recreate the editor on every
  // keystroke — nuking focus and racing `getHTML` against a destroyed editor
  // (schema-null crash). Later content arrives via imperative `setValue`.
  const [seedHtml] = useState(defaultHtml);
  // Stable handlers: the web host resubscribes its editor listeners whenever
  // these identities change, and the parent re-renders on every keystroke.
  const handleChangeHtml = useCallback(
    (event: NativeSyntheticEvent<{ value: string }>) => onHtmlChange(event.nativeEvent.value),
    [onHtmlChange],
  );
  const handleChangeState = useCallback(
    (event: NativeSyntheticEvent<LibStyleState>) => onMarksChange(marksFromStyleState(event.nativeEvent)),
    [onMarksChange],
  );
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        input: {
          flex: 1,
          color: colors.text,
          fontSize: manuscriptTextMetrics.fontSize,
          lineHeight: manuscriptTextMetrics.lineHeight,
          paddingHorizontal: manuscriptTextMetrics.containerPaddingHorizontal,
          paddingVertical: manuscriptTextMetrics.containerPaddingVertical,
        },
      }),
    [colors],
  );
  return (
    <View style={styles.container} testID={testID}>
      <EnrichedTextInput
        ref={inputRef}
        testID={testID ? `${testID}.input` : undefined}
        style={styles.input}
        defaultValue={seedHtml}
        onChangeHtml={handleChangeHtml}
        onChangeState={handleChangeState}
        editable={editable}
        autoFocus={autoFocus}
        placeholder={t('manuscript_empty')}
        placeholderTextColor={colors.textSecondary}
        scrollEnabled={false}
        selectionColor={colors.primary}
        // Links are outside the manuscript model: pasted URLs stay plain text.
        linkRegex={null}
      />
    </View>
  );
}

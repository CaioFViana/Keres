import type { ManuscriptMark } from '@keres/shared';
import { createElement, useCallback, useMemo, useState, type RefObject } from 'react';
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
  /**
   * Whether the user may edit at all (story role). The web remount key tracks
   * this — not `editable`: transient disables (saving) must not remount, or
   * overlapping remounts race the host's async seed application and the loser
   * (an empty transient emit) wipes the doc. Defaults to `editable`.
   */
  canEdit?: boolean;
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
 * DOM anchor for the web-only inner-host CSS below (react-native-web renders
 * `id` as the element id). One editor instance per screen, so a fixed id is
 * safe — and a second editor would want the same native look anyway.
 */
const WEB_CSS_SCOPE_ID = 'keres-rich-body-editor';

/**
 * Inner-host layout the `style` prop cannot reach: it lands inline on the
 * host wrapper, but the nested contenteditable sizes to its content without
 * this — a one-line box with the focus ring hugging the text instead of a
 * seamless full-area editor. Scoped to our container (`>div` is the host
 * wrapper, our only div child; `.ProseMirror` is TipTap-stable) so no other
 * element is touched. Padding lives on the inner node so clicks on the
 * padded area land inside the editable and focus it.
 */
export const RICH_BODY_EDITOR_WEB_CSS = [
  `#${WEB_CSS_SCOPE_ID}>div{display:flex;flex-direction:column}`,
  `#${WEB_CSS_SCOPE_ID} .ProseMirror{flex:1;padding:${manuscriptTextMetrics.containerPaddingVertical}px ${manuscriptTextMetrics.containerPaddingHorizontal}px}`,
  `#${WEB_CSS_SCOPE_ID} .ProseMirror:focus{outline:none}`,
].join('');

function ManuscriptEditorWebChrome() {
  if (Platform.OS !== 'web') return null;
  // `dangerouslySetInnerHTML` (not a string child): identical DOM output, and
  // it keeps the RN test renderer — which only allows text inside `<Text>` —
  // able to mount this branch.
  return createElement('style', { dangerouslySetInnerHTML: { __html: RICH_BODY_EDITOR_WEB_CSS } });
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
  // syncs it afterwards, while permission starts false and resolves async
  // with the story role — remount the input when it changes so read-only
  // never sticks. The remount reseeds from the live doc prop, so no typed
  // content is lost. Native applies `editable` live.
  const editable = props.editable ?? true;
  const canEdit = props.canEdit ?? editable;
  const inputKey = Platform.OS === 'web' ? `canedit-${canEdit}` : 'input';
  return <RichBodyEditorInner key={inputKey} {...props} canEdit={canEdit} editable={editable} />;
}

function RichBodyEditorInner({
  defaultHtml,
  onHtmlChange,
  onMarksChange,
  editable = true,
  canEdit = true,
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
          // Web-only: without it the bare host div falls back to the browser
          // default face instead of the app's system stack (see metrics).
          // (Plain `Platform.OS` check like the gates above: `Platform.select`
          // is hardcoded per bundle platform and ignores OS overrides.)
          fontFamily:
            Platform.OS === 'web' ? manuscriptTextMetrics.webFontFamily : undefined,
          fontSize: manuscriptTextMetrics.fontSize,
          lineHeight: manuscriptTextMetrics.lineHeight,
          // Web keeps the wrapper padding-free: it lives on the inner
          // contenteditable via RICH_BODY_EDITOR_WEB_CSS so padding clicks
          // focus the editor (read-mode metrics, same values).
          paddingHorizontal:
            Platform.OS === 'web' ? 0 : manuscriptTextMetrics.containerPaddingHorizontal,
          paddingVertical:
            Platform.OS === 'web' ? 0 : manuscriptTextMetrics.containerPaddingVertical,
        },
      }),
    [colors],
  );
  // Permitted-but-disabled (saving) locks pointer input without remounting:
  // the remount key above ignores transient disables, so the container takes
  // over the lock the `editable` flip used to imply on web.
  const pointerEvents = canEdit && !editable ? 'none' : 'auto';
  return (
    <View
      style={styles.container}
      testID={testID}
      id={WEB_CSS_SCOPE_ID}
      pointerEvents={pointerEvents}
    >
      <ManuscriptEditorWebChrome />
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

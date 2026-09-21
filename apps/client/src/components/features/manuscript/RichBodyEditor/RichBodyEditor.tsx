import type { ManuscriptDocument, ManuscriptMark } from '@keres/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { useTheme } from '../../../../theme';
import type { ManuscriptEditorSelection } from '../manuscriptDocumentEngine';
import { manuscriptTextMetrics } from '../manuscriptTextMetrics';

export type RichBodyEditorProps = {
  doc: ManuscriptDocument;
  surfaceText: string;
  selection?: ManuscriptEditorSelection;
  onChangeText(text: string): void;
  onSelectionChange?(selection: ManuscriptEditorSelection): void;
  editable?: boolean;
  autoFocus?: boolean;
  testID?: string;
};

type OverlaySegment = { text: string; style: TextStyle };

function decorationLine(marks: ManuscriptMark[]): TextStyle['textDecorationLine'] {
  const underline = marks.includes('underline');
  const strike = marks.includes('strikethrough');
  if (underline && strike) return 'underline line-through';
  if (underline) return 'underline';
  if (strike) return 'line-through';
  return 'none';
}

/**
 * The overlay renders the document runs over the identical surface string, so
 * the ghost Text aligns char-for-char with the input and no source-to-render
 * map is ever needed. There are no markers here at all: styling is span
 * metadata, and block separators are plain text like in the input.
 */
function buildOverlaySegments(doc: ManuscriptDocument, baseColor: string): OverlaySegment[] {
  const segments: OverlaySegment[] = [];
  doc.blocks.forEach((block, blockIndex) => {
    if (blockIndex > 0) {
      segments.push({ text: '\n\n', style: { color: baseColor } });
    }
    // Headings mirror the reader size so write mode previews read mode.
    const headingSize =
      block.kind === 'heading'
        ? Math.round(
            manuscriptTextMetrics.fontSize * manuscriptTextMetrics.headingScale[block.level],
          )
        : null;
    const headingStyle: TextStyle = headingSize
      ? { fontSize: headingSize, lineHeight: Math.round(headingSize * 1.4) }
      : {};
    for (const span of block.spans) {
      segments.push({
        text: span.text,
        style: {
          color: baseColor,
          fontWeight: span.marks.includes('bold') ? '700' : '400',
          fontStyle: span.marks.includes('italic') ? 'italic' : 'normal',
          textDecorationLine: decorationLine(span.marks),
          ...headingStyle,
        },
      });
    }
  });
  return segments;
}

/**
 * The manuscript prose input with WYSIWYG formatting: a transparent `TextInput`
 * showing the markup-free surface over a ghost `Text` that paints the document
 * runs. The input stays the sole touch target, so the keyboard, autocorrect,
 * IME and the OS selection handles are all native; the overlay only paints.
 * Both layers share `manuscriptTextMetrics` exactly, so toggling between
 * writing and reading never shifts the layout.
 */
export function RichBodyEditor({
  doc,
  surfaceText,
  selection,
  onChangeText,
  onSelectionChange,
  editable = true,
  autoFocus = false,
  testID,
}: RichBodyEditorProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  // Pure derivation from props: no render-adjust state, nothing to latch.
  const segments = useMemo(() => buildOverlaySegments(doc, colors.text), [doc, colors.text]);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, position: 'relative', backgroundColor: colors.surface },
        overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
        overlayText: {
          color: colors.text,
          fontSize: manuscriptTextMetrics.fontSize,
          lineHeight: manuscriptTextMetrics.lineHeight,
          paddingHorizontal: manuscriptTextMetrics.containerPaddingHorizontal,
          paddingVertical: manuscriptTextMetrics.containerPaddingVertical,
        },
        input: {
          flex: 1,
          color: 'transparent',
          backgroundColor: 'transparent',
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
    <View style={styles.container} testID={testID}>
      <View style={styles.overlay} pointerEvents="none">
        <Text testID={testID ? `${testID}.overlay` : undefined} style={styles.overlayText}>
          {segments.map((segment, index) => (
            <Text key={index} style={segment.style}>
              {segment.text}
            </Text>
          ))}
        </Text>
      </View>
      <TextInput
        testID={testID ? `${testID}.input` : undefined}
        style={styles.input}
        value={surfaceText}
        onChangeText={onChangeText}
        selection={selection}
        onSelectionChange={(event) => onSelectionChange?.(event.nativeEvent.selection)}
        multiline
        editable={editable}
        autoFocus={autoFocus}
        placeholder={t('manuscript_empty')}
        placeholderTextColor={colors.textSecondary}
        scrollEnabled={false}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
      />
    </View>
  );
}

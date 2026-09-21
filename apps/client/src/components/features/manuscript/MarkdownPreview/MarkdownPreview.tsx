import type { ManuscriptMark, ManuscriptSpan } from '@keres/shared';
import { parseMarkdownToDocument } from '@keres/shared';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useTheme } from '../../../../theme';
import { manuscriptTextMetrics } from '../manuscriptTextMetrics';

function decorationLine(marks: ManuscriptMark[]): TextStyle['textDecorationLine'] {
  const underline = marks.includes('underline');
  const strike = marks.includes('strikethrough');
  if (underline && strike) return 'underline line-through';
  if (underline) return 'underline';
  if (strike) return 'line-through';
  return 'none';
}

function InlineText({ span }: { span: ManuscriptSpan }) {
  return (
    <Text
      style={{
        fontWeight: span.marks.includes('bold') ? '700' : '400',
        fontStyle: span.marks.includes('italic') ? 'italic' : 'normal',
        textDecorationLine: decorationLine(span.marks),
        fontSize: manuscriptTextMetrics.fontSize,
      }}
    >
      {span.text}
    </Text>
  );
}

/**
 * Read-mode renderer over the shared document model — the same model the
 * editor writes, so combined marks (`***both***`) render exactly as typed and
 * write mode and read mode can never diverge. The legacy client markdown
 * parser stays with the export pipeline, which owns its own AST.
 */
export function MarkdownPreview({
  text,
  testID,
  selectable = true,
}: {
  text: string;
  testID?: string;
  selectable?: boolean;
}) {
  const { colors } = useTheme();
  const doc = useMemo(() => parseMarkdownToDocument(text), [text]);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        block: { marginBottom: manuscriptTextMetrics.paragraphSpacing },
        paragraph: {
          color: colors.text,
          fontSize: manuscriptTextMetrics.fontSize,
          lineHeight: manuscriptTextMetrics.lineHeight,
        },
        // Blank lines read as full beats with no text node to pollute copies.
        blankBlock: {
          height: manuscriptTextMetrics.lineHeight,
          marginBottom: manuscriptTextMetrics.paragraphSpacing,
        },
      }),
    [colors],
  );
  return (
    <View testID={testID}>
      {doc.blocks.map((block, index) =>
        block.spans.length === 0 ? (
          <View key={`block-${index}`} style={styles.blankBlock} />
        ) : (
          <View key={`block-${index}`} style={styles.block}>
            <Text selectable={selectable} style={styles.paragraph}>
              {block.spans.map((span, spanIndex) => (
                <InlineText key={spanIndex} span={span} />
              ))}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}

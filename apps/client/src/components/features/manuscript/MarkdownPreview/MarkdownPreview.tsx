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
 * write mode and read mode can never diverge. The export pipeline owns its
 * own reader AST in `@keres/shared`.
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
  // Trailing Enters are storage, not reading: a body ending in blank lines
  // would otherwise air the section end (and, between scenes, pile a blank
  // join onto the divider). Leading and interior blanks stay byte-honest.
  const blocks = useMemo(() => {
    const visible = [...doc.blocks];
    while (visible.length > 0 && visible[visible.length - 1].spans.length === 0) {
      visible.pop();
    }
    return visible;
  }, [doc]);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        block: { marginBottom: manuscriptTextMetrics.paragraphSpacing },
        paragraph: {
          color: colors.text,
          fontSize: manuscriptTextMetrics.fontSize,
          lineHeight: manuscriptTextMetrics.lineHeight,
        },
        // Blank lines read as full beats with no text node to pollute copies:
        // exactly one line-height, no margins, so each stored blank line
        // costs one line — the same beat as the editor's empty line.
        blankBlock: {
          height: manuscriptTextMetrics.lineHeight,
        },
      }),
    [colors],
  );
  return (
    <View testID={testID}>
      {blocks.map((block, index) =>
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

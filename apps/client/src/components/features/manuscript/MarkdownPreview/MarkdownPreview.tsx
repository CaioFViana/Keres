import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { manuscriptTextMetrics } from '../manuscriptTextMetrics';
import {
  parseManuscriptMarkdown,
  type ManuscriptInline,
} from '../parseManuscriptMarkdown';

function InlineText({ span, baseSize }: { span: ManuscriptInline; baseSize: number }) {
  const decorations: ('underline' | 'line-through')[] = [
    ...(span.underline ? (['underline'] as const) : []),
    ...(span.strikethrough ? (['line-through'] as const) : []),
  ];
  const textDecorationLine: 'none' | 'underline' | 'line-through' | 'underline line-through' =
    decorations.length === 2 ? 'underline line-through' : (decorations[0] ?? 'none');
  return (
    <Text
      style={{
        fontWeight: span.bold ? '700' : '400',
        fontStyle: span.italic ? 'italic' : 'normal',
        textDecorationLine,
        fontSize: baseSize,
      }}
    >
      {span.text}
    </Text>
  );
}

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
  const blocks = useMemo(() => parseManuscriptMarkdown(text), [text]);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        block: { marginBottom: manuscriptTextMetrics.paragraphSpacing },
        paragraph: {
          color: colors.text,
          fontSize: manuscriptTextMetrics.fontSize,
          lineHeight: manuscriptTextMetrics.lineHeight,
        },
      }),
    [colors],
  );
  return (
    <View testID={testID}>
      {blocks.map((block) => {
        const isHeading = block.kind === 'heading';
        const size = isHeading
          ? Math.round(
              manuscriptTextMetrics.fontSize * manuscriptTextMetrics.headingScale[block.level],
            )
          : manuscriptTextMetrics.fontSize;
        return (
          <View key={block.key} style={styles.block}>
            <Text
              selectable={selectable}
              style={[
                styles.paragraph,
                isHeading && {
                  fontSize: size,
                  lineHeight: Math.round(size * 1.4),
                  fontWeight: '700',
                },
              ]}
            >
              {block.inlines.map((span, index) => (
                <InlineText key={index} span={span} baseSize={size} />
              ))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

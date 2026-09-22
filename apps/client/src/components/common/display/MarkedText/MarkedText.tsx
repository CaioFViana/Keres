import type { TextRange } from '@keres/shared';
import { splitTextByRanges } from '@keres/shared';
import React, { useMemo } from 'react';
import { Text, type TextProps } from 'react-native';
import { useTheme } from '../../../../theme';

interface MarkedTextProps extends Omit<TextProps, 'children'> {
  text: string;
  /** Precomputed highlight spans (comment anchors, search hits); empty renders plain text. */
  ranges: TextRange[];
}

/**
 * Plain text with highlighter-style marks over `ranges`, sharing one splitter and one
 * theme fill (`primaryContainer`) across comment anchors and manuscript search hits.
 * Without ranges it renders a single bare `<Text>`, so unmarked trees stay untouched.
 */
const MarkedText: React.FC<MarkedTextProps> = ({ text, ranges, style, ...rest }) => {
  const { colors } = useTheme();
  const segments = useMemo(() => splitTextByRanges(text, ranges), [text, ranges]);

  if (segments.length === 1 && !segments[0].marked) {
    return (
      <Text style={style} {...rest}>
        {text}
      </Text>
    );
  }
  return (
    <Text style={style} {...rest}>
      {segments.map((segment, index) =>
        segment.marked ? (
          <Text key={index} style={{ backgroundColor: colors.primaryContainer }}>
            {segment.text}
          </Text>
        ) : (
          <Text key={index}>{segment.text}</Text>
        ),
      )}
    </Text>
  );
};

export default MarkedText;

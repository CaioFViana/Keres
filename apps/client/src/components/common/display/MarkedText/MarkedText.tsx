import type { TextRange } from '@keres/shared';
import { splitTextByActiveRanges, splitTextByRanges } from '@keres/shared';
import React, { useMemo } from 'react';
import { Text, type TextProps } from 'react-native';
import { useTheme } from '../../../../theme';

interface MarkedTextProps extends Omit<TextProps, 'children'> {
  text: string;
  /** Precomputed highlight spans (comment anchors, search hits); empty renders plain text. */
  ranges: TextRange[];
  /**
   * The current span among `ranges`, drawn with the strong fill (manuscript search's
   * ordinal hit). Empty or absent marks every range equally, as before.
   */
  activeRanges?: TextRange[];
  /** Attached to the active span's host, so the manuscript can scroll it into view. */
  activeRef?: React.Ref<Text>;
}

/**
 * Plain text with highlighter-style marks over `ranges`, sharing one splitter and one
 * theme fill (`primaryContainer`) across comment anchors and manuscript search hits.
 * Without ranges it renders a single bare `<Text>`, so unmarked trees stay untouched.
 */
const MarkedText: React.FC<MarkedTextProps> = ({
  text,
  ranges,
  activeRanges,
  activeRef,
  style,
  ...rest
}) => {
  const { colors } = useTheme();
  const segments = useMemo(
    () =>
      activeRanges && activeRanges.length > 0
        ? splitTextByActiveRanges(text, ranges, activeRanges)
        : splitTextByRanges(text, ranges).map((segment) => ({ ...segment, active: false })),
    [text, ranges, activeRanges],
  );

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
          <Text
            key={index}
            ref={segment.active ? activeRef : undefined}
            style={
              segment.active
                ? { backgroundColor: colors.primary, color: colors.onPrimary }
                : { backgroundColor: colors.primaryContainer }
            }
          >
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

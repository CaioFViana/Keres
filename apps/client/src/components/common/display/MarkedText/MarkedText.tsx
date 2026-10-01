import type { TextRange } from '@keres/shared';
import {
  splitTextByActiveRanges,
  splitTextByCommentRanges,
  splitTextByRanges,
} from '@keres/shared';
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
  /** Comment-excerpt spans: same fill as `ranges`, tappable via `onCommentPress`. */
  commentRanges?: TextRange[];
  /** Fired when a comment-marked span is tapped (opens that field's thread). */
  onCommentPress?: () => void;
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
  commentRanges,
  onCommentPress,
  style,
  ...rest
}) => {
  const { colors } = useTheme();
  const hasComments = !!commentRanges && commentRanges.length > 0;
  const segments = useMemo(
    () =>
      hasComments
        ? splitTextByCommentRanges(text, ranges, commentRanges ?? [], activeRanges ?? [])
        : activeRanges && activeRanges.length > 0
          ? splitTextByActiveRanges(text, ranges, activeRanges).map((segment) => ({
              ...segment,
              comment: false,
            }))
          : splitTextByRanges(text, ranges).map((segment) => ({
              ...segment,
              active: false,
              comment: false,
            })),
    [text, ranges, activeRanges, commentRanges, hasComments],
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
            onPress={segment.comment && onCommentPress ? onCommentPress : undefined}
            accessibilityRole={segment.comment && onCommentPress ? 'button' : undefined}
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

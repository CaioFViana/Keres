import React, { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TextRange } from '@keres/shared';
import { useMentions } from '../../../../mentions/MentionContext';
import { useTheme } from '../../../../theme';
import {
  splitTextIntoMentionSegments,
  type MentionSegment,
} from '../../../../utils/entityMentions';
import MarkedText from '../MarkedText/MarkedText';

interface DetailFieldProps {
  label: string;
  value: string;
  onPress?: () => void;
  /**
   * The entity this field belongs to. Passing it turns on automatic mention links in the value
   * (when the story has them enabled) and keeps the entity from linking to itself.
   */
  mentionSourceId?: string;
  /** Comment-excerpt spans over `value`, drawn with the search-style fill. */
  commentRanges?: TextRange[];
  /** Fired when a comment-marked span is tapped (opens that field's thread). */
  onCommentPress?: () => void;
  /** Lets the user select the value (web excerpt pre-fill reads it). */
  selectable?: boolean;
}

/** The overlap of global `ranges` with one segment, shifted into segment-local offsets. */
function localRanges(ranges: TextRange[], start: number, length: number): TextRange[] {
  const end = start + length;
  const local: TextRange[] = [];
  for (const range of ranges) {
    const overlapStart = Math.max(range.start, start);
    const overlapEnd = Math.min(range.start + range.length, end);
    if (overlapEnd > overlapStart) {
      local.push({ start: overlapStart - start, length: overlapEnd - overlapStart });
    }
  }
  return local;
}

/**
 * Label-above-value display for a single field on a read-only Detail screen. Same
 * treatment for every field - short ones (gender) and long free-text ones (biography)
 * alike - so a screen doesn't need to hand-pick styling per field.
 */
const DetailField: React.FC<DetailFieldProps> = ({
  label,
  value,
  onPress,
  mentionSourceId,
  commentRanges,
  onCommentPress,
  selectable = false,
}) => {
  const { colors } = useTheme();
  const { matcher, openMention } = useMentions();
  const hasCommentRanges = !!commentRanges && commentRanges.length > 0;

  // `onPress` makes the whole value one link (an ENTITY custom attribute); there is no text left to
  // scan for mentions inside it - and comment marks stay off, so one tap never means two things.
  const segments = useMemo(
    () =>
      onPress || matcher.isEmpty
        ? null
        : splitTextIntoMentionSegments(value, matcher, { selfId: mentionSourceId }),
    [onPress, matcher, value, mentionSourceId],
  );
  // Without mentions the value is one segment of its own: comment marks still split it.
  const renderSegments: MentionSegment[] = segments ?? [{ text: value, start: 0 }];

  const styles = StyleSheet.create({
    container: {
      marginBottom: 12,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    value: {
      fontSize: 16,
      color: colors.text,
      lineHeight: 22,
    },
    linkedValue: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    linkedValueText: { color: colors.primary, flexShrink: 1 },
    // Colour only, no underline: a paragraph with several mentions should still read as prose.
    mention: { color: colors.primary },
    linkIcon: { marginLeft: 4 },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {onPress ? (
        <TouchableOpacity style={styles.linkedValue} onPress={onPress}>
          <Text style={[styles.value, styles.linkedValueText]}>{value}</Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.primary}
            style={styles.linkIcon}
          />
        </TouchableOpacity>
      ) : hasCommentRanges ? (
        <Text style={styles.value} selectable={selectable}>
          {renderSegments.map((segment, index) => {
            const local = localRanges(commentRanges ?? [], segment.start, segment.text.length);
            // Comment wins over mention on an overlap: one tap, one meaning.
            if (segment.ref && local.length === 0) {
              return (
                <Text
                  key={index}
                  style={styles.mention}
                  onPress={() => openMention(segment.ref!)}
                  accessibilityRole="link"
                >
                  {segment.text}
                </Text>
              );
            }
            if (local.length === 0) {
              return <Text key={index}>{segment.text}</Text>;
            }
            return (
              <MarkedText
                key={index}
                text={segment.text}
                ranges={[]}
                commentRanges={local}
                onCommentPress={onCommentPress}
              />
            );
          })}
        </Text>
      ) : segments && segments.some((segment) => segment.ref) ? (
        <Text style={styles.value} selectable={selectable}>
          {segments.map((segment, index) =>
            segment.ref ? (
              <Text
                key={index}
                style={styles.mention}
                onPress={() => openMention(segment.ref!)}
                accessibilityRole="link"
              >
                {segment.text}
              </Text>
            ) : (
              <Text key={index}>{segment.text}</Text>
            ),
          )}
        </Text>
      ) : (
        <Text style={styles.value} selectable={selectable}>
          {value}
        </Text>
      )}
    </View>
  );
};

export default DetailField;

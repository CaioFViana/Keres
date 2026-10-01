import React, { useEffect, useMemo, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TextRange } from '@keres/shared';
import { useOccurrenceFlash } from '../../../../hooks/useOccurrenceLanding';
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
  /**
   * Schema field key (`biography`) or custom-attribute key (`custom:<fieldId>`).
   * The occurrence-landing target with this key scrolls the field into view,
   * flashing the needle where it sits.
   */
  fieldKey?: string;
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
  fieldKey,
}) => {
  const { colors } = useTheme();
  const { matcher, openMention } = useMentions();
  const hasCommentRanges = !!commentRanges && commentRanges.length > 0;
  const { targeted, target, flashRanges, requestScroll } = useOccurrenceFlash(fieldKey, value);
  const containerRef = useRef<View | null>(null);
  const spanRef = useRef<Text | null>(null);
  // The landing scroll follows data, not just navigation: an entity swap under the
  // same screen re-lays-out after the refetch, and the stale measurement's
  // continuation dies on the controller's generation. No state set here.
  useEffect(() => {
    if (!targeted) return;
    requestScroll(spanRef.current ?? containerRef.current);
  }, [targeted, target, value, requestScroll]);

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
  // The flash slices onto segments exactly like comment marks; the first touched
  // segment hosts the scroll measurement, so long fields land on the occurrence
  // itself rather than the field top. Untouched, the field container stands in.
  const flashBySegment = renderSegments.map((segment) =>
    localRanges(flashRanges, segment.start, segment.text.length),
  );
  const firstFlashIndex = flashBySegment.findIndex((local) => local.length > 0);

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
  // Flash fills read as the manuscript's current hit: strong fill, legible ink.
  const flashHostStyle = { backgroundColor: colors.primary };
  const flashInkStyle = { color: colors.onPrimary };

  return (
    <View ref={containerRef} style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {onPress ? (
        <TouchableOpacity style={styles.linkedValue} onPress={onPress}>
          <Text
            style={[
              styles.value,
              styles.linkedValueText,
              flashRanges.length > 0 && flashHostStyle,
              flashRanges.length > 0 && flashInkStyle,
            ]}
          >
            {value}
          </Text>
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
            const flashLocal = flashBySegment[index];
            // Comment wins over mention on an overlap: one tap, one meaning.
            if (segment.ref && local.length === 0 && flashLocal.length === 0) {
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
            if (local.length === 0 && flashLocal.length === 0) {
              return <Text key={index}>{segment.text}</Text>;
            }
            return (
              <MarkedText
                key={index}
                text={segment.text}
                ranges={flashLocal}
                activeRanges={flashLocal}
                activeRef={index === firstFlashIndex ? spanRef : undefined}
                commentRanges={local}
                onCommentPress={onCommentPress}
              />
            );
          })}
        </Text>
      ) : segments && segments.some((segment) => segment.ref) ? (
        <Text style={styles.value} selectable={selectable}>
          {segments.map((segment, index) => {
            const flashLocal = flashBySegment[index];
            if (flashLocal.length === 0) {
              return segment.ref ? (
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
              );
            }
            // Flashed spans nest the link inside the fill host, so the mention
            // stays tappable while it flashes.
            return (
              <Text
                key={index}
                ref={index === firstFlashIndex ? spanRef : undefined}
                style={flashHostStyle}
              >
                {segment.ref ? (
                  <Text
                    style={[styles.mention, flashInkStyle]}
                    onPress={() => openMention(segment.ref!)}
                    accessibilityRole="link"
                  >
                    {segment.text}
                  </Text>
                ) : (
                  <Text style={flashInkStyle}>{segment.text}</Text>
                )}
              </Text>
            );
          })}
        </Text>
      ) : flashRanges.length > 0 ? (
        <MarkedText
          text={value}
          ranges={flashRanges}
          activeRanges={flashRanges}
          activeRef={spanRef}
          style={styles.value}
          selectable={selectable}
        />
      ) : (
        <Text style={styles.value} selectable={selectable}>
          {value}
        </Text>
      )}
    </View>
  );
};

export default DetailField;

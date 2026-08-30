import React, { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMentions } from '../../../../mentions/MentionContext';
import { useTheme } from '../../../../theme';
import { splitTextIntoMentionSegments } from '../../../../utils/entityMentions';

interface DetailFieldProps {
  label: string;
  value: string;
  onPress?: () => void;
  /**
   * The entity this field belongs to. Passing it turns on automatic mention links in the value
   * (when the story has them enabled) and keeps the entity from linking to itself.
   */
  mentionSourceId?: string;
}

/**
 * Label-above-value display for a single field on a read-only Detail screen. Same
 * treatment for every field - short ones (gender) and long free-text ones (biography)
 * alike - so a screen doesn't need to hand-pick styling per field.
 */
const DetailField: React.FC<DetailFieldProps> = ({ label, value, onPress, mentionSourceId }) => {
  const { colors } = useTheme();
  const { matcher, openMention } = useMentions();

  // `onPress` makes the whole value one link (an ENTITY custom attribute); there is no text left to
  // scan for mentions inside it.
  const segments = useMemo(
    () =>
      onPress || matcher.isEmpty
        ? null
        : splitTextIntoMentionSegments(value, matcher, { selfId: mentionSourceId }),
    [onPress, matcher, value, mentionSourceId],
  );

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
      ) : segments && segments.some((segment) => segment.ref) ? (
        <Text style={styles.value}>
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
        <Text style={styles.value}>{value}</Text>
      )}
    </View>
  );
};

export default DetailField;

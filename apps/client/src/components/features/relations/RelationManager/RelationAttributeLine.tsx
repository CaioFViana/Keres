import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../../../../theme';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';

interface RelationAttributeLineProps {
  label: string;
  value: string;
}

/**
 * One "Label: value" line inside a GenericRelationDisplay item's extra content (e.g. "Scene:
 * Throne Room", "Item state: Broken"). Every relation manager (LocationCharacterManager,
 * ItemSceneManager, ChapterSceneManager...) used to hand-write this as a single plain Text
 * with no distinction between the attribute name and its value, repeated with the same
 * `fontSize: 14, color: colors.textSecondary` in each file - reused here so the label reads
 * as a label (bold, full-contrast) instead of blending into the value next to it.
 */
const RelationAttributeLine: React.FC<RelationAttributeLineProps> = ({ label, value }) => {
  const { colors } = useTheme();
  const styles = StyleSheet.create(relationSectionStyleDefs(colors));

  return (
    <Text style={styles.attributeLine}>
      <Text style={styles.attributeLabel}>{label}: </Text>
      <Text style={styles.attributeValue}>{value}</Text>
    </Text>
  );
};

export default RelationAttributeLine;

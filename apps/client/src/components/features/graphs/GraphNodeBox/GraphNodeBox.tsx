import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fontSize, fontWeight, space } from '../../../../theme/tokens';
import { useThemedStyles } from '../../../../theme/useThemedStyles';
import type { ThemeColors } from '../../../../theme';

export interface GraphNodeBoxNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  labelLines: string[];
  isIsolated: boolean;
}

interface GraphNodeBoxProps {
  node: GraphNodeBoxNode;
  /** `pill` is a person, `box` is a place: the shape tells the two graphs apart at a glance. */
  shape: 'pill' | 'box';
  /** The node the author tapped: drawn filled, so there is no doubt about which one is in focus. */
  selected: boolean;
  /** A node the focus filter chose: outlined in the primary colour. */
  highlighted: boolean;
  /** Not part of the focus: kept in place but faded back. */
  dimmed: boolean;
  /** What a screen reader says: the name and how many relations it has. */
  accessibilityLabel: string;
  onPress: () => void;
}

const RADIUS = { pill: 22, box: 8 } as const;

/**
 * A node of a relation graph: the name in a box. Both relation graphs draw their nodes with this one,
 * so selection, the filter's choice, "no relations" and fading look the same on both, and a screen
 * reader hears the same thing from either.
 */
const GraphNodeBox: React.FC<GraphNodeBoxProps> = ({
  node,
  shape,
  selected,
  highlighted,
  dimmed,
  accessibilityLabel,
  onPress,
}) => {
  const styles = useThemedStyles(createStyles, [shape]);
  const emphasised = selected || highlighted;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={[styles.node, { left: node.x, top: node.y, width: node.width, height: node.height }]}
    >
      <View
        style={[
          styles.inner,
          node.isIsolated && styles.isolated,
          emphasised && styles.emphasised,
          selected && styles.selected,
          // On the inner view: TouchableOpacity owns the opacity of its own host while pressed.
          dimmed && styles.dimmed,
        ]}
      >
        {node.labelLines.map((line, index) => (
          <Text
            key={index}
            style={[styles.label, selected && styles.labelSelected]}
            numberOfLines={1}
          >
            {line}
          </Text>
        ))}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: ThemeColors, [shape]: [GraphNodeBoxProps['shape']]) =>
  StyleSheet.create({
    node: {
      position: 'absolute',
      borderRadius: RADIUS[shape],
      overflow: 'hidden',
      outlineWidth: 0,
    },
    inner: {
      flex: 1,
      borderRadius: RADIUS[shape] - 1,
      borderWidth: 1.2,
      borderColor: colors.border,
      paddingHorizontal: space.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryContainer,
    },
    isolated: {
      backgroundColor: colors.surface,
      borderStyle: 'dashed',
      borderColor: colors.textSecondary,
    },
    emphasised: { borderWidth: 2.5, borderColor: colors.primary },
    selected: { backgroundColor: colors.primary },
    dimmed: { opacity: 0.28 },
    label: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.text,
      textAlign: 'center',
    },
    labelSelected: { color: colors.onPrimary },
  });

export default GraphNodeBox;

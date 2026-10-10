import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import ThemedText from '../../../common/display/ThemedText/ThemedText';
import { useTheme, type ThemeColors } from '../../../../theme';
import { fontSize, radius, space } from '../../../../theme/tokens';
import { useThemedStyles } from '../../../../theme/useThemedStyles';

export interface GraphLegendItem {
  id: string;
  label: string;
  color: string;
  /** A dashed line, for the kind of edge that is told apart by its stroke rather than its colour. */
  dashed?: boolean;
  /** With a handler the row is a switch: pressing it shows or hides that kind of line on the map. */
  onToggle?: () => void;
  /** The kind is switched off: its row is struck out and its lines are not drawn. */
  hidden?: boolean;
}

interface GraphLegendProps {
  /** The name of the chip, e.g. `Legend`. */
  title: string;
  items: GraphLegendItem[];
}

/**
 * What the lines of a graph mean, kept out of the way: a small chip that opens into the list. The
 * items come from the data on screen, so the legend only names what the author can actually see.
 */
const GraphLegend: React.FC<GraphLegendProps> = ({ title, items }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      {open && (
        <View style={styles.card} accessibilityLabel={title}>
          <ScrollView style={styles.list}>
            {items.map((item) => {
              const content = (
                <>
                  <View
                    testID={`graph-legend-swatch-${item.id}`}
                    style={[
                      styles.swatch,
                      { borderTopColor: item.color },
                      item.dashed && styles.swatchDashed,
                    ]}
                  />
                  <ThemedText
                    style={[styles.label, item.hidden && styles.labelHidden]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </ThemedText>
                </>
              );
              return item.onToggle ? (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.row, item.hidden && styles.rowHidden]}
                  onPress={item.onToggle}
                  accessibilityRole="checkbox"
                  accessibilityLabel={item.label}
                  accessibilityState={{ checked: !item.hidden }}
                >
                  {content}
                </TouchableOpacity>
              ) : (
                <View key={item.id} style={styles.row}>
                  {content}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
      <TouchableOpacity
        style={styles.chip}
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
      >
        <Ionicons name={open ? 'chevron-down' : 'list-outline'} size={16} color={colors.text} />
        <ThemedText style={styles.chipText}>{title}</ThemedText>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { position: 'absolute', left: space.lg, bottom: space.xxl, alignItems: 'flex-start' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      borderRadius: radius.xl * 2,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      outlineWidth: 0,
    },
    chipText: { fontSize: fontSize.sm },
    card: {
      marginBottom: space.md,
      padding: space.lg,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      maxWidth: 260,
    },
    list: { maxHeight: 180 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.xs },
    swatch: { width: 26, height: 0, borderTopWidth: 3 },
    swatchDashed: { borderStyle: 'dashed' },
    label: { flexShrink: 1, fontSize: fontSize.md },
    labelHidden: { textDecorationLine: 'line-through', color: colors.textSecondary },
    rowHidden: { opacity: 0.55 },
  });

export default GraphLegend;

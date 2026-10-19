import type { ThemeColors } from '@keres/shared/theme/ThemeColors';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface GraphFilterSummaryProps {
  colors: ThemeColors;
  hint: string;
  clearLabel: string;
  onClear(): void;
}

/** The line under the focus filter: what it does and how to undo it. */
const GraphFilterSummary = ({ colors, hint, clearLabel, onClear }: GraphFilterSummaryProps) => {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        filterActions: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingBottom: 8,
        },
        filterHint: {
          color: colors.textSecondary,
          fontSize: 12,
          flex: 1,
        },
        filterAction: { paddingVertical: 5 },
        filterActionText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
      }),
    [colors],
  );

  return (
    <View style={styles.filterActions}>
      <Text style={styles.filterHint}>{hint}</Text>
      <TouchableOpacity style={styles.filterAction} onPress={onClear}>
        <Text style={styles.filterActionText}>{clearLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default GraphFilterSummary;

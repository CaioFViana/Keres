import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@keres/shared/theme/ThemeColors';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { commonDetailStyleDefs, commonScreenStyleDefs } from '../../../../theme/commonStyles';

interface GraphEmptyStateProps {
  colors: ThemeColors;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  message: string;
}

/** What a graph screen shows instead of an empty canvas. */
const GraphEmptyState = ({ colors, icon, message }: GraphEmptyStateProps) => {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        ...commonScreenStyleDefs(colors),
        ...commonDetailStyleDefs(colors),
      }),
    [colors],
  );

  return (
    <View style={styles.container}>
      <View style={styles.emptyContainer}>
        <Ionicons name={icon} size={54} color={colors.textSecondary} />
        <Text style={styles.emptyText}>{message}</Text>
      </View>
    </View>
  );
};

export default GraphEmptyState;

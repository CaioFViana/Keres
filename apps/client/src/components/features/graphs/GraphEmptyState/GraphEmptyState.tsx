import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@keres/shared/theme/ThemeColors';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../../../common/controls/Button/Button';
import { commonDetailStyleDefs, commonScreenStyleDefs } from '../../../../theme/commonStyles';

interface GraphEmptyStateProps {
  colors: ThemeColors;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  message: string;
  /** A second line that says what to do next. */
  hint?: string;
  /** The way out of the emptiness, e.g. a button that creates the first character. */
  actionLabel?: string;
  onAction?: () => void;
}

/** What a graph screen shows instead of an empty canvas. */
const GraphEmptyState = ({
  colors,
  icon,
  message,
  hint,
  actionLabel,
  onAction,
}: GraphEmptyStateProps) => {
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
        {!!hint && (
          <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 8 }]}>
            {hint}
          </Text>
        )}
        {!!actionLabel && !!onAction && (
          <Button onPress={onAction} style={{ marginTop: 20 }}>
            {actionLabel}
          </Button>
        )}
      </View>
    </View>
  );
};

export default GraphEmptyState;

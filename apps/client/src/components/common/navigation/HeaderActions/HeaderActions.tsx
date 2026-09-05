import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/src/theme';

export interface HeaderAction {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  visible?: boolean;
  disabled?: boolean;
  busy?: boolean;
}

export default function HeaderActions({ actions }: { actions: readonly HeaderAction[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {actions
        .filter((action) => action.visible !== false)
        .map((action) => (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{
              disabled: !!(action.disabled || action.busy),
              busy: !!action.busy,
            }}
            disabled={action.disabled || action.busy}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.action,
              { opacity: action.disabled ? 0.4 : pressed ? 0.6 : 1 },
            ]}
          >
            {action.busy ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Ionicons name={action.icon} size={24} color={colors.text} />
            )}
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginRight: 8, gap: 4 },
  action: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});

import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../../theme';
import { useTheme } from '../../../theme';

export interface ServerActionRowProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  /** One line on what it does. */
  description: string;
  /** The destructive action wears the error colour. */
  destructive?: boolean;
  onPress: () => void;
  testID?: string;
}

/** One thing the user can do with a server, on the server's own screen. */
const ServerActionRow: React.FC<ServerActionRowProps> = ({
  icon,
  title,
  description,
  destructive,
  onPress,
  testID,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tint = destructive ? colors.error : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Ionicons name={icon} size={24} color={tint} />
      <View style={styles.text}>
        <Text style={[styles.title, destructive && { color: colors.error }]}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    rowPressed: { opacity: 0.85 },
    text: { flex: 1, minWidth: 0 },
    title: { fontSize: 16, fontWeight: '600', color: colors.text },
    description: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  });

export default ServerActionRow;
